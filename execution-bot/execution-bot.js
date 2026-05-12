import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

// ─── Config ──────────────────────────────────────────────────────
const RPC_URL         = process.env.RPC_URL    || 'https://api.test.stablenet.network';
const PRIVATE_KEY     = process.env.PRIVATE_KEY;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL; // Web App URL (doGet + doPost 공용)

const SWAP_ROUTER = '0x8920e24184Ae7a1D55d64ef42f319139E9A72885';
const FEE = 500;

const TOKEN = {
  TUSD: '0x6e13fac4f535d6727668fc6e2e724bfb52b6e274',
  TKRW: '0x244e7f6ae105430cd3260e5d869fb0625d5c4d0c',
  TJPY: '0xe9a2be5da45a4e677327cb8ae0bf9195d7e679d8',
  TEUR: '0xe7b1040376e005ce0fa8b5914d00adbf6e4cc99d',
};

// 방향 → tokenIn / tokenOut / amountIn (10K TUSD 상당)
const SWAP_MAP = {
  'USDKRW_BUY stUSD':  { in: TOKEN.TKRW, out: TOKEN.TUSD, amount: 14_000_000n },
  'USDKRW_BUY stKRW':  { in: TOKEN.TUSD, out: TOKEN.TKRW, amount: 10_000n },
  'USDJPY_BUY stUSD':  { in: TOKEN.TJPY, out: TOKEN.TUSD, amount: 1_540_000n },
  'USDJPY_BUY stJPY':  { in: TOKEN.TUSD, out: TOKEN.TJPY, amount: 10_000n },
  'USDEUR_SELL stUSD': { in: TOKEN.TUSD, out: TOKEN.TEUR, amount: 10_000n },
  'USDEUR_BUY stUSD':  { in: TOKEN.TEUR, out: TOKEN.TUSD, amount: 9_200n },
  'KRWJPY_BUY stKRW':  { in: TOKEN.TJPY, out: TOKEN.TKRW, amount: 1_540_000n },
  'KRWJPY_BUY stJPY':  { in: TOKEN.TKRW, out: TOKEN.TJPY, amount: 14_000_000n },
};

const POLL_INTERVAL_MS  = 5 * 60 * 1000;   // 5분마다 기회 체크
const COOLDOWN_MS       = 30 * 60 * 1000;  // 실행 후 30분 쿨다운

// ─── ABIs ────────────────────────────────────────────────────────
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
];

const ROUTER_ABI = [
  `function exactInputSingle(
    (address tokenIn, address tokenOut, uint24 fee, address recipient,
     uint256 deadline, uint256 amountIn, uint256 amountOutMinimum,
     uint160 sqrtPriceLimitX96) params
  ) payable returns (uint256 amountOut)`,
];

// ─── Helpers ─────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function now() {
  return new Date().toISOString().replace('T', ' ').substring(0, 16);
}

// ─── Apps Script 조회 (doGet) ────────────────────────────────────
async function fetchLatestOpportunity() {
  try {
    const res  = await fetch(APPS_SCRIPT_URL);
    const data = await res.json();
    return data.result === 'found' ? data : null;
  } catch (e) {
    console.error('fetchLatestOpportunity failed:', e.message);
    return null;
  }
}

// ─── Apps Script 기록 (doPost) ───────────────────────────────────
async function reportResult(entry) {
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      redirect: 'follow',
    });
  } catch (e) {
    console.error('reportResult failed:', e.message);
  }
}

// ─── Approve 확인 ────────────────────────────────────────────────
async function ensureApproval(wallet, tokenAddress, symbol) {
  const token     = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  const allowance = await token.allowance(wallet.address, SWAP_ROUTER);
  if (allowance < ethers.parseUnits('1000000', 18)) {
    console.log(`  Approving ${symbol}...`);
    const tx = await token.approve(SWAP_ROUTER, ethers.MaxUint256);
    await tx.wait();
    console.log(`  ✅ ${symbol} approved`);
  }
}

// ─── 스왑 실행 ───────────────────────────────────────────────────
async function executeSwap(wallet, router, swapConfig) {
  const amountIn = swapConfig.amount * 10n ** 18n;

  // 잔액 확인
  const token   = new ethers.Contract(swapConfig.in, ERC20_ABI, wallet);
  const balance = await token.balanceOf(wallet.address);
  if (balance < amountIn) {
    throw new Error(`잔액 부족: ${balance} < ${amountIn}`);
  }

  const params = {
    tokenIn:           swapConfig.in,
    tokenOut:          swapConfig.out,
    fee:               FEE,
    recipient:         wallet.address,
    deadline:          BigInt(Math.floor(Date.now() / 1000) + 1800),
    amountIn:          amountIn,
    amountOutMinimum:  0n,
    sqrtPriceLimitX96: 0n,
  };

  const tx      = await router.exactInputSingle(params);
  const receipt = await tx.wait();
  return { hash: receipt.hash, amountIn: amountIn.toString() };
}

// ─── Main loop ───────────────────────────────────────────────────
async function main() {
  if (!PRIVATE_KEY)     throw new Error('PRIVATE_KEY not set');
  if (!APPS_SCRIPT_URL) throw new Error('APPS_SCRIPT_URL not set');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
  const router   = new ethers.Contract(SWAP_ROUTER, ROUTER_ABI, wallet);

  console.log('🤖 Execution Bot 시작');
  console.log(`   지갑: ${wallet.address}`);
  console.log(`   RPC:  ${RPC_URL}\n`);

  // 시작 시 approve 확인
  console.log('── Approve 확인 중...');
  for (const [symbol, address] of Object.entries(TOKEN)) {
    await ensureApproval(wallet, address, symbol);
  }
  console.log('');

  let lastExecutedAt = 0;

  while (true) {
    const opportunity = await fetchLatestOpportunity();

    if (!opportunity) {
      console.log(`[${now()}] 기회 없음 — ${POLL_INTERVAL_MS / 60000}분 후 재확인`);
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    // 쿨다운 체크
    const elapsed = Date.now() - lastExecutedAt;
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
      console.log(`[${now()}] 쿨다운 중 (${remaining}분 남음)`);
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    const key = `${opportunity.pair}_${opportunity.direction}`;
    const swapConfig = SWAP_MAP[key];

    if (!swapConfig) {
      console.warn(`[${now()}] 알 수 없는 방향: ${key}`);
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    console.log(`\n[${now()}] 기회 감지`);
    console.log(`   페어:  ${opportunity.pair}`);
    console.log(`   방향:  ${opportunity.direction}`);
    console.log(`   spread: ${opportunity.spread_pct}`);

    try {
      const result = await executeSwap(wallet, router, swapConfig);

      console.log(`   ✅ 스왑 성공 | tx: ${result.hash}`);

      await reportResult({
        executed_at: now(),
        pair:        opportunity.pair,
        direction:   opportunity.direction,
        spread_pct:  opportunity.spread_pct,
        tx_hash:     result.hash,
        status:      'EXECUTED',
        pnl_est:     '',
      });

      lastExecutedAt = Date.now();
      console.log(`   📋 Trade_Log 기록 완료`);

    } catch (err) {
      console.error(`   ❌ 스왑 실패: ${err.message}`);

      await reportResult({
        executed_at: now(),
        pair:        opportunity.pair,
        direction:   opportunity.direction,
        spread_pct:  opportunity.spread_pct,
        tx_hash:     'FAILED',
        status:      'FAILED',
        pnl_est:     '',
      });
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

main().catch(console.error);

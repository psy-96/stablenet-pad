import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

// ─── Config ──────────────────────────────────────────────────────
const RPC_URL         = process.env.RPC_URL    || 'https://api.test.stablenet.network';
const PRIVATE_KEY     = process.env.PRIVATE_KEY;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

const SWAP_ROUTER = '0x8920e24184Ae7a1D55d64ef42f319139E9A72885';
const FEE = 500;

const TOKEN = {
  TUSD: '0x6e13fac4f535d6727668fc6e2e724bfb52b6e274',
  TKRW: '0x244e7f6ae105430cd3260e5d869fb0625d5c4d0c',
  TJPY: '0xe9a2be5da45a4e677327cb8ae0bf9195d7e679d8',
  TEUR: '0xe7b1040376e005ce0fa8b5914d00adbf6e4cc99d',
};

// ── Noise Bot: 랜덤 스왑 페어 ─────────────────────────────────────
const NOISE_PAIRS = [
  { name: 'TUSD/TKRW', in: TOKEN.TUSD, out: TOKEN.TKRW },
  { name: 'TKRW/TUSD', in: TOKEN.TKRW, out: TOKEN.TUSD },
  { name: 'TUSD/TJPY', in: TOKEN.TUSD, out: TOKEN.TJPY },
  { name: 'TJPY/TUSD', in: TOKEN.TJPY, out: TOKEN.TUSD },
  { name: 'TUSD/TEUR', in: TOKEN.TUSD, out: TOKEN.TEUR },
  { name: 'TEUR/TUSD', in: TOKEN.TEUR, out: TOKEN.TUSD },
  { name: 'TKRW/TJPY', in: TOKEN.TKRW, out: TOKEN.TJPY },
  { name: 'TJPY/TKRW', in: TOKEN.TJPY, out: TOKEN.TKRW },
];

// tokenIn별 노이즈 스왑 금액 범위 (5K~20K TUSD 상당)
const NOISE_AMOUNT = {
  [TOKEN.TUSD]: { min: 5_000n,      max: 20_000n      },
  [TOKEN.TKRW]: { min: 7_000_000n,  max: 28_000_000n  },
  [TOKEN.TJPY]: { min: 800_000n,    max: 3_200_000n   },
  [TOKEN.TEUR]: { min: 4_600n,      max: 18_400n      },
};

const NOISE_MIN_INTERVAL = 15 * 60 * 1000;
const NOISE_MAX_INTERVAL = 45 * 60 * 1000;

// ── Execution Bot: 방향 → 스왑 설정 ──────────────────────────────
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

const EXEC_POLL_INTERVAL = 5 * 60 * 1000;   // 5분마다 기회 체크
const EXEC_COOLDOWN      = 30 * 60 * 1000;  // 실행 후 30분 쿨다운

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
const sleep  = ms => new Promise(r => setTimeout(r, ms));
const nowStr = () => {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().replace('T', ' ').substring(0, 16);
};

function randBetween(min, max) {
  return min + BigInt(Math.floor(Math.random() * Number(max - min)));
}
function randMs(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}
function fmtMs(ms) {
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${m}분 ${s}초`;
}

// ─── Approve ─────────────────────────────────────────────────────
async function ensureApprovals(wallet) {
  for (const [symbol, address] of Object.entries(TOKEN)) {
    const token     = new ethers.Contract(address, ERC20_ABI, wallet);
    const allowance = await token.allowance(wallet.address, SWAP_ROUTER);
    if (allowance < ethers.parseUnits('1000000', 18)) {
      console.log(`  Approving ${symbol}...`);
      const tx = await token.approve(SWAP_ROUTER, ethers.MaxUint256);
      await tx.wait();
      console.log(`  ✅ ${symbol} approved`);
    } else {
      console.log(`  ✅ ${symbol} already approved`);
    }
  }
}

// ─── 공통 스왑 실행 ───────────────────────────────────────────────
async function doSwap(wallet, router, tokenIn, tokenOut, amountIn) {
  const token   = new ethers.Contract(tokenIn, ERC20_ABI, wallet);
  const balance = await token.balanceOf(wallet.address);
  if (balance < amountIn) throw new Error(`잔액 부족: ${balance} < ${amountIn}`);

  const tx = await router.exactInputSingle({
    tokenIn,
    tokenOut,
    fee:               FEE,
    recipient:         wallet.address,
    deadline:          BigInt(Math.floor(Date.now() / 1000) + 1800),
    amountIn,
    amountOutMinimum:  0n,
    sqrtPriceLimitX96: 0n,
  });
  return await tx.wait();
}

// ─── Apps Script 통신 ────────────────────────────────────────────
async function fetchOpportunity() {
  if (!APPS_SCRIPT_URL) return null;
  try {
    const res  = await fetch(APPS_SCRIPT_URL);
    const data = await res.json();
    return data.result === 'found' ? data : null;
  } catch (e) {
    console.error('[Execution] fetchOpportunity failed:', e.message);
    return null;
  }
}

async function reportResult(entry) {
  if (!APPS_SCRIPT_URL) return;
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      redirect: 'manual',  // 리다이렉트 따라가지 않음 → 원본 POST가 doPost() 트리거
    });
    console.log(`[Exec] reportResult status: ${res.status}`);
  } catch (e) {
    console.error('[Exec] reportResult failed:', e.message);
  }
}

// ─── Noise Bot 루프 ───────────────────────────────────────────────
async function noiseLoop(wallet, router) {
  let count = 0;
  while (true) {
    const waitMs = randMs(NOISE_MIN_INTERVAL, NOISE_MAX_INTERVAL);
    console.log(`[Noise] ⏳ 다음 스왑까지 ${fmtMs(waitMs)} 대기...`);
    await sleep(waitMs);

    const pair   = NOISE_PAIRS[Math.floor(Math.random() * NOISE_PAIRS.length)];
    const range  = NOISE_AMOUNT[pair.in];
    const amount = randBetween(range.min, range.max) * 10n ** 18n;

    count++;
    try {
      const receipt = await doSwap(wallet, router, pair.in, pair.out, amount);
      console.log(`[Noise] #${count} ${pair.name} ✅ tx: ${receipt.hash}`);
    } catch (e) {
      if (e.message.includes('잔액 부족')) {
        console.log(`[Noise] #${count} ${pair.name} ⚠️ 잔액 부족, 스킵`);
      } else {
        console.error(`[Noise] #${count} ${pair.name} ❌ ${e.message}`);
      }
    }
  }
}

// ─── Execution Bot 루프 ───────────────────────────────────────────
async function executionLoop(wallet, router) {
  let lastExecutedAt = 0;

  while (true) {
    await sleep(EXEC_POLL_INTERVAL);

    const opp = await fetchOpportunity();
    if (!opp) {
      console.log(`[Exec] 기회 없음`);
      continue;
    }

    const elapsed = Date.now() - lastExecutedAt;
    if (elapsed < EXEC_COOLDOWN) {
      const remaining = Math.ceil((EXEC_COOLDOWN - elapsed) / 60000);
      console.log(`[Exec] 쿨다운 중 (${remaining}분 남음)`);
      continue;
    }

    const key    = `${opp.pair}_${opp.direction}`;
    const config = SWAP_MAP[key];

    if (!config) {
      console.warn(`[Exec] 알 수 없는 방향: ${key}`);
      continue;
    }

    console.log(`\n[Exec] 기회 감지 — ${opp.pair} ${opp.direction} ${opp.spread_pct}`);

    try {
      const receipt = await doSwap(
        wallet, router,
        config.in, config.out,
        config.amount * 10n ** 18n
      );

      console.log(`[Exec] ✅ 스왑 성공 | tx: ${receipt.hash}`);
      await reportResult({
        executed_at: nowStr(), pair: opp.pair,
        direction: opp.direction, spread_pct: opp.spread_pct,
        tx_hash: receipt.hash, status: 'EXECUTED', pnl_est: '',
      });
      lastExecutedAt = Date.now();

    } catch (e) {
      console.error(`[Exec] ❌ 스왑 실패: ${e.message}`);
      await reportResult({
        executed_at: nowStr(), pair: opp.pair,
        direction: opp.direction, spread_pct: opp.spread_pct,
        tx_hash: 'FAILED', status: 'FAILED', pnl_est: '',
      });
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY not set');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
  const router   = new ethers.Contract(SWAP_ROUTER, ROUTER_ABI, wallet);

  console.log('🤖 Noise Bot + Execution Bot 시작');
  console.log(`   지갑: ${wallet.address}`);
  console.log(`   RPC:  ${RPC_URL}\n`);

  console.log('── Approve 확인 중...');
  await ensureApprovals(wallet);
  console.log('');

  await Promise.all([
    noiseLoop(wallet, router),
    executionLoop(wallet, router),
  ]);
}

main().catch(console.error);
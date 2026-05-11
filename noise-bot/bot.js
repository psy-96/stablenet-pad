import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

// ─── Config ──────────────────────────────────────────────────────
const RPC_URL    = process.env.RPC_URL    || 'https://rpc.stablenet.network/archive';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const SWAP_ROUTER = '0x8920e24184Ae7a1D55d64ef42f319139E9A72885';
const FEE = 500;

const TOKEN = {
  TUSD: '0x6e13fac4f535d6727668fc6e2e724bfb52b6e274',
  TKRW: '0x244e7f6ae105430cd3260e5d869fb0625d5c4d0c',
  TJPY: '0xe9a2be5da45a4e677327cb8ae0bf9195d7e679d8',
  TEUR: '0xe7b1040376e005ce0fa8b5914d00adbf6e4cc99d',
};

// 스왑 페어 정의 (양방향)
const PAIRS = [
  { name: 'TUSD/TKRW', in: TOKEN.TUSD, out: TOKEN.TKRW },
  { name: 'TKRW/TUSD', in: TOKEN.TKRW, out: TOKEN.TUSD },
  { name: 'TUSD/TJPY', in: TOKEN.TUSD, out: TOKEN.TJPY },
  { name: 'TJPY/TUSD', in: TOKEN.TJPY, out: TOKEN.TUSD },
  { name: 'TUSD/TEUR', in: TOKEN.TUSD, out: TOKEN.TEUR },
  { name: 'TEUR/TUSD', in: TOKEN.TEUR, out: TOKEN.TUSD },
  { name: 'TKRW/TJPY', in: TOKEN.TKRW, out: TOKEN.TJPY },
  { name: 'TJPY/TKRW', in: TOKEN.TJPY, out: TOKEN.TKRW },
];

// tokenIn별 스왑 금액 범위 (TUSD 5,000~20,000 기준 환산)
const AMOUNT_RANGE = {
  [TOKEN.TUSD]: { min: 5_000n,          max: 20_000n          },  // 5K~20K TUSD
  [TOKEN.TKRW]: { min: 7_000_000n,      max: 28_000_000n      },  // ≈5K~20K USD
  [TOKEN.TJPY]: { min: 800_000n,        max: 3_200_000n       },  // ≈5K~20K USD
  [TOKEN.TEUR]: { min: 4_600n,          max: 18_400n          },  // ≈5K~20K USD
};

// 실행 간격: 15~45분 랜덤
const MIN_INTERVAL_MS = 15 * 60 * 1000;
const MAX_INTERVAL_MS = 45 * 60 * 1000;

// ─── ABIs ────────────────────────────────────────────────────────
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const ROUTER_ABI = [
  `function exactInputSingle(
    (address tokenIn, address tokenOut, uint24 fee, address recipient,
     uint256 deadline, uint256 amountIn, uint256 amountOutMinimum,
     uint160 sqrtPriceLimitX96) params
  ) payable returns (uint256 amountOut)`,
];

// ─── Helpers ─────────────────────────────────────────────────────
function randBetween(min, max) {
  const range = max - min;
  return min + BigInt(Math.floor(Math.random() * Number(range)));
}

function randMs(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs)) + minMs;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function formatMs(ms) {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}분 ${sec}초`;
}

// ─── Approve all tokens to SwapRouter ────────────────────────────
async function ensureApprovals(wallet) {
  const MAX = ethers.MaxUint256;
  for (const [symbol, address] of Object.entries(TOKEN)) {
    const token = new ethers.Contract(address, ERC20_ABI, wallet);
    const allowance = await token.allowance(wallet.address, SWAP_ROUTER);
    if (allowance < ethers.parseUnits('1000000', 18)) {
      console.log(`  Approving ${symbol}...`);
      const tx = await token.approve(SWAP_ROUTER, MAX);
      await tx.wait();
      console.log(`  ✅ ${symbol} approved`);
    } else {
      console.log(`  ✅ ${symbol} already approved`);
    }
  }
}

// ─── Execute single swap ──────────────────────────────────────────
async function executeSwap(wallet, router, pair) {
  const range  = AMOUNT_RANGE[pair.in];
  const amountIn = randBetween(range.min, range.max) * 10n ** 18n;

  // 잔액 확인
  const token = new ethers.Contract(pair.in, ERC20_ABI, wallet);
  const balance = await token.balanceOf(wallet.address);
  if (balance < amountIn) {
    console.log(`  ⚠️  잔액 부족 (${pair.name}), 스킵`);
    return null;
  }

  const params = {
    tokenIn:              pair.in,
    tokenOut:             pair.out,
    fee:                  FEE,
    recipient:            wallet.address,
    deadline:             BigInt(Math.floor(Date.now() / 1000) + 1800),
    amountIn:             amountIn,
    amountOutMinimum:     0n,
    sqrtPriceLimitX96:    0n,
  };

  const tx = await router.exactInputSingle(params);
  const receipt = await tx.wait();
  return receipt;
}

// ─── Main loop ───────────────────────────────────────────────────
async function main() {
  if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY not set in .env');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
  const router   = new ethers.Contract(SWAP_ROUTER, ROUTER_ABI, wallet);

  console.log('🤖 Noise Bot 시작');
  console.log(`   지갑: ${wallet.address}`);
  console.log(`   RPC:  ${RPC_URL}\n`);

  // 최초 1회 approve
  console.log('── Approve 확인 중...');
  await ensureApprovals(wallet);
  console.log('');

  let swapCount = 0;

  while (true) {
    // 랜덤 대기
    const waitMs = randMs(MIN_INTERVAL_MS, MAX_INTERVAL_MS);
    console.log(`⏳ 다음 스왑까지 ${formatMs(waitMs)} 대기...`);
    await sleep(waitMs);

    // 랜덤 페어 선택
    const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
    swapCount++;

    console.log(`\n[#${swapCount}] ${new Date().toISOString()}`);
    console.log(`   페어: ${pair.name}`);

    try {
      const receipt = await executeSwap(wallet, router, pair);
      if (receipt) {
        console.log(`   ✅ 스왑 성공 | tx: ${receipt.hash}`);
      }
    } catch (err) {
      console.error(`   ❌ 스왑 실패: ${err.message}`);
    }
  }
}

main().catch(console.error);

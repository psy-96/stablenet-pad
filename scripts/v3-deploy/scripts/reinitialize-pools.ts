import { ethers } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

// ── 주소 상수 ─────────────────────────────────────────────────────────────────
const POSITION_MANAGER = '0x245a9b3937b28cfAE315D9E498ae46A758652Ad1'
const OWNER            = '0x069331CB8ADC2E376f0A2F8a6CDDee4f021e07cD'

const TOKEN = {
  TUSD: '0x6e13fac4f535d6727668fc6e2e724bfb52b6e274',
  TKRW: '0x244e7f6ae105430cd3260e5d869fb0625d5c4d0c',
  TJPY: '0xe9a2be5da45a4e677327cb8ae0bf9195d7e679d8',
  TEUR: '0xe7b1040376e005ce0fa8b5914d00adbf6e4cc99d',
} as const

// ── 풀 설정 ───────────────────────────────────────────────────────────────────
// 실환율 2026-05-14 기준
// USDKRW 1495, USDJPY 157.8, USDEUR 1.171, KRWJPY 0.1055
//
// price = token1 / token0 (token0 < token1 주소 기준)
// token0IsBase=true  → price = token0 기준 token1 단가
// token0IsBase=false → price = token1 기준 token0 단가 (역수)
//
// 각 풀 token0/token1 ordering은 주소 크기 비교로 결정됨:
//   TKRW(0x244e) < TUSD(0x6e13) → TKRW=token0, TUSD=token1
//   TUSD(0x6e13) < TJPY(0xe9a2) → TUSD=token0, TJPY=token1
//   TUSD(0x6e13) < TEUR(0xe7b1) → TUSD=token0, TEUR=token1
//   TKRW(0x244e) < TJPY(0xe9a2) → TKRW=token0, TJPY=token1

interface PoolConfig {
  address:      string
  tokenId:      number        // 회수할 NonfungiblePositionManager tokenId
  token0:       string        // 주소 작은 쪽
  token1:       string        // 주소 큰 쪽
  fee:          number        // 500 (0.05%)
  // price = token1/token0 (18 decimals 기준 raw 비율)
  // 예: TKRW/TUSD 풀 → price = TUSD per TKRW = 1/1495
  price:        number
  // 유동성 공급 범위 (±N% → tickLower/tickUpper 계산)
  rangePct:     number
  // 각 토큰 공급량 (단위: 해당 토큰)
  amount0:      bigint
  amount1:      bigint
}

const POOLS: PoolConfig[] = [
  {
    // TKRW/TUSD — token0=TKRW, token1=TUSD
    // price = TUSD per TKRW = 1/1495 ≈ 0.0006689
    address:  '0x1DE1642256DD4F479C60975C0F12a861DF499b1e',
    tokenId:  1,
    token0:   TOKEN.TKRW,
    token1:   TOKEN.TUSD,
    fee:      500,
    price:    1 / 1495,
    rangePct: 20,
    amount0:  ethers.parseUnits('14900000', 18),   // 14.9M TKRW (~$10k)
    amount1:  ethers.parseUnits('9970',     18),   // ~$10k TUSD
  },
  {
    // TUSD/TJPY — token0=TUSD, token1=TJPY
    // price = TJPY per TUSD = 157.8
    address:  '0x789C1b717d9291781256472Ccf6Fe3d04208DB35',
    tokenId:  2,
    token0:   TOKEN.TUSD,
    token1:   TOKEN.TJPY,
    fee:      500,
    price:    157.8,
    rangePct: 20,
    amount0:  ethers.parseUnits('9970',      18),  // ~$10k TUSD
    amount1:  ethers.parseUnits('1573266',   18),  // ~$10k TJPY
  },
  {
    // TUSD/TEUR — token0=TUSD, token1=TEUR
    // price = TEUR per TUSD = 1/1.171 ≈ 0.8540
    address:  '0xc98A7B66C51276E94D686a4e4C808ebb26Df6b76',
    tokenId:  3,
    token0:   TOKEN.TUSD,
    token1:   TOKEN.TEUR,
    fee:      500,
    price:    1 / 1.171,
    rangePct: 20,
    amount0:  ethers.parseUnits('9970',  18),      // ~$10k TUSD
    amount1:  ethers.parseUnits('8514',  18),      // ~$10k TEUR
  },
  {
    // TKRW/TJPY — token0=TKRW, token1=TJPY
    // price = TJPY per TKRW = 0.1055
    address:  '0xB7E99f032Ac4e24fd7B8E4330f1E9CECe207ceaA',
    tokenId:  4,
    token0:   TOKEN.TKRW,
    token1:   TOKEN.TJPY,
    fee:      500,
    price:    0.1055,
    rangePct: 20,
    amount0:  ethers.parseUnits('14900000', 18),   // ~$10k 상당 TKRW
    amount1:  ethers.parseUnits('1571950',  18),   // ~$10k 상당 TJPY
  },
]

// ── ABIs ─────────────────────────────────────────────────────────────────────
const ABIS_DIR = path.join(__dirname, '..', 'abis')

function loadAbi(file: string): ethers.InterfaceAbi {
  return JSON.parse(
    fs.readFileSync(path.join(ABIS_DIR, file), 'utf-8')
  ) as ethers.InterfaceAbi
}

const POOL_ABI = loadAbi('abi_v3pool.json')
const PM_ABI   = loadAbi('abi_positionmanager.json')

// ── sqrtPriceX96 계산 ────────────────────────────────────────────────────────
// price = token1/token0 (양쪽 모두 18 decimals이므로 raw 비율 그대로)
// sqrtPriceX96 = sqrt(price) * 2^96
function priceToSqrtPriceX96(price: number): bigint {
  const sqrtPrice = Math.sqrt(price)
  const Q96 = 2n ** 96n
  // 정밀도 보존을 위해 1e18 스케일 후 정수 계산
  const SCALE = BigInt(1e18)
  const sqrtScaled = BigInt(Math.round(sqrtPrice * 1e18))
  return (sqrtScaled * Q96) / SCALE
}

// ── tick 계산 ─────────────────────────────────────────────────────────────────
// tick = floor(log(price) / log(1.0001))
// tickSpacing=10 (fee=500)
function priceToTick(price: number): number {
  return Math.floor(Math.log(price) / Math.log(1.0001))
}

function roundTickToSpacing(tick: number, tickSpacing: number): number {
  return Math.round(tick / tickSpacing) * tickSpacing
}

// ── 재시도 래퍼 ──────────────────────────────────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, label: string, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  [${label}] 시도 ${attempt}/${retries} 실패: ${msg}`)
      if (attempt === retries) throw err
      await new Promise(r => setTimeout(r, 3000))
    }
  }
  throw new Error('unreachable')
}

// ── ERC20 approve ─────────────────────────────────────────────────────────────
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]

async function ensureApprove(
  tokenAddress: string,
  spender: string,
  amount: bigint,
  signer: ethers.Signer
) {
  const token     = new ethers.Contract(tokenAddress, ERC20_ABI, signer)
  const owner     = await signer.getAddress()
  const allowance = await token.allowance(owner, spender) as bigint
  if (allowance < amount) {
    console.log(`    approve ${tokenAddress.slice(0, 10)}... → ${spender.slice(0, 10)}...`)
    const tx = await token.approve(spender, ethers.MaxUint256)
    await tx.wait()
  }
}

// ── 포지션 회수 ───────────────────────────────────────────────────────────────
async function withdrawPosition(
  pm: ethers.Contract,
  pool: ethers.Contract,
  cfg: PoolConfig,
  signer: ethers.Signer
) {
  const owner = await signer.getAddress()
  console.log(`\n[tokenId ${cfg.tokenId}] 포지션 회수 시작`)

  // 1. positions() 로 현재 유동성 / tickRange 조회
  const pos = await pm.positions(cfg.tokenId) as {
    liquidity: bigint
    tickLower: bigint
    tickUpper: bigint
    tokensOwed0: bigint
    tokensOwed1: bigint
  }

  console.log(`  liquidity : ${pos.liquidity}`)
  console.log(`  tickRange : [${pos.tickLower}, ${pos.tickUpper}]`)

  if (pos.liquidity === 0n) {
    console.log(`  ⚠️  유동성 없음 — decreaseLiquidity 스킵`)
  } else {
    // 2. decreaseLiquidity (전량)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800)
    const decreaseTx = await withRetry(
      () => pm.decreaseLiquidity({
        tokenId:          cfg.tokenId,
        liquidity:        pos.liquidity,
        amount0Min:       0n,
        amount1Min:       0n,
        deadline,
      }),
      `decreaseLiquidity tokenId=${cfg.tokenId}`
    )
    const r1 = await decreaseTx.wait()
    console.log(`  ✓ decreaseLiquidity tx: ${r1.hash}`)
  }

  // 3. collect (수수료 + 회수된 토큰 전량)
  const MAX_UINT128 = (1n << 128n) - 1n
  const collectTx = await withRetry(
    () => pm.collect({
      tokenId:          cfg.tokenId,
      recipient:        owner,
      amount0Max:       MAX_UINT128,
      amount1Max:       MAX_UINT128,
    }),
    `collect tokenId=${cfg.tokenId}`
  )
  const r2 = await collectTx.wait()
  console.log(`  ✓ collect tx: ${r2.hash}`)

  // 4. burn NFT (선택 — 풀 재사용 시 생략 가능, 여기서는 실행)
  const burnTx = await withRetry(
    () => pm.burn(cfg.tokenId),
    `burn tokenId=${cfg.tokenId}`
  )
  const r3 = await burnTx.wait()
  console.log(`  ✓ burn tx: ${r3.hash}`)
}

// ── 풀 가격 재초기화 ──────────────────────────────────────────────────────────
// V3 풀은 한 번 initialize된 후 재초기화 불가.
// 대신 swap으로 가격을 맞추거나, 새 풀을 배포해야 함.
// 여기서는 현재 풀 가격과 목표 가격을 비교해 경고만 출력.
// 실제 가격 조정은 스왑 또는 풀 재배포 중 선택 필요.
async function checkAndWarnPoolPrice(
  pool: ethers.Contract,
  cfg: PoolConfig
) {
  const slot0 = await pool.slot0() as { sqrtPriceX96: bigint; tick: bigint }
  const Q96   = 2n ** 96n
  const SCALE = BigInt(1e12)
  const currentPrice = Number(slot0.sqrtPriceX96 * slot0.sqrtPriceX96 * SCALE / (Q96 * Q96)) / 1e12
  const targetPrice  = cfg.price

  console.log(`  현재 pool price : ${currentPrice.toFixed(8)}`)
  console.log(`  목표 pool price : ${targetPrice.toFixed(8)}`)
  console.log(`  현재 tick       : ${slot0.tick}`)

  const diff = Math.abs(currentPrice - targetPrice) / targetPrice
  if (diff > 0.01) {
    console.warn(`  ⚠️  가격 괴리 ${(diff * 100).toFixed(2)}% — 스왑으로 가격 조정 필요`)
  } else {
    console.log(`  ✓ 가격 오차 ${(diff * 100).toFixed(4)}% — 허용 범위 내`)
  }
}

// ── 유동성 재공급 (mint) ──────────────────────────────────────────────────────
async function mintPosition(
  pm: ethers.Contract,
  cfg: PoolConfig,
  signer: ethers.Signer
): Promise<{ tokenId: bigint; liquidity: bigint; amount0: bigint; amount1: bigint }> {
  const owner = await signer.getAddress()

  const TICK_SPACING = 10  // fee=500 풀의 tickSpacing

  const currentTick  = priceToTick(cfg.price)
  const lowerPrice   = cfg.price * (1 - cfg.rangePct / 100)
  const upperPrice   = cfg.price * (1 + cfg.rangePct / 100)
  const tickLower    = roundTickToSpacing(priceToTick(lowerPrice), TICK_SPACING)
  const tickUpper    = roundTickToSpacing(priceToTick(upperPrice), TICK_SPACING)

  console.log(`\n[mint] ${cfg.address.slice(0, 10)}...`)
  console.log(`  price     : ${cfg.price}`)
  console.log(`  tickLower : ${tickLower}  tickCurrent: ${currentTick}  tickUpper: ${tickUpper}`)
  console.log(`  amount0   : ${ethers.formatUnits(cfg.amount0, 18)}`)
  console.log(`  amount1   : ${ethers.formatUnits(cfg.amount1, 18)}`)

  // approve
  await ensureApprove(cfg.token0, await pm.getAddress(), cfg.amount0, signer)
  await ensureApprove(cfg.token1, await pm.getAddress(), cfg.amount1, signer)

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800)

  const tx = await withRetry(
    () => pm.mint({
      token0:         cfg.token0,
      token1:         cfg.token1,
      fee:            cfg.fee,
      tickLower,
      tickUpper,
      amount0Desired: cfg.amount0,
      amount1Desired: cfg.amount1,
      amount0Min:     0n,
      amount1Min:     0n,
      recipient:      owner,
      deadline,
    }),
    `mint ${cfg.address.slice(0, 10)}`
  )
  const receipt = await tx.wait()
  console.log(`  ✓ mint tx: ${receipt.hash}`)

  // IncreaseLiquidity 이벤트에서 tokenId 파싱
  const iface    = pm.interface
  const mintLog  = receipt.logs
    .map((log: ethers.Log) => { try { return iface.parseLog(log) } catch { return null } })
    .find((e: ethers.LogDescription | null) => e?.name === 'IncreaseLiquidity')

  if (mintLog) {
    const { tokenId, liquidity, amount0, amount1 } = mintLog.args
    console.log(`  tokenId   : ${tokenId}`)
    console.log(`  liquidity : ${liquidity}`)
    console.log(`  amount0   : ${ethers.formatUnits(amount0, 18)}`)
    console.log(`  amount1   : ${ethers.formatUnits(amount1, 18)}`)
    return { tokenId, liquidity, amount0, amount1 }
  }

  throw new Error('IncreaseLiquidity 이벤트를 찾을 수 없음')
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  const [signer] = await ethers.getSigners()
  const signerAddress = await signer.getAddress()
  const network = await ethers.provider.getNetwork()

  console.log('═'.repeat(56))
  console.log('  v0.2 풀 재초기화 — StableNet Testnet')
  console.log('═'.repeat(56))
  console.log(`  서명자  : ${signerAddress}`)
  console.log(`  chainId : ${network.chainId}`)

  if (signerAddress.toLowerCase() !== OWNER.toLowerCase()) {
    throw new Error(`서명자(${signerAddress})가 오너(${OWNER})와 다릅니다`)
  }

  const pm = new ethers.Contract(POSITION_MANAGER, PM_ABI, signer)

  const results: Array<{
    pool: string
    newTokenId: bigint
    liquidity: bigint
    amount0: bigint
    amount1: bigint
  }> = []

  for (const cfg of POOLS) {
    console.log('\n' + '─'.repeat(56))
    console.log(`풀: ${cfg.address}`)

    const pool = new ethers.Contract(cfg.address, POOL_ABI, signer)

    // ① 기존 포지션 전량 회수
    await withdrawPosition(pm, pool, cfg, signer)

    // ② 현재 풀 가격 확인 (V3 풀은 재초기화 불가이므로 경고 출력)
    await checkAndWarnPoolPrice(pool, cfg)

    // ③ 새 가격 범위로 유동성 재공급
    const mintResult = await mintPosition(pm, cfg, signer)
    results.push({ pool: cfg.address, ...mintResult })
  }

  // ── 결과 요약 ─────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(56))
  console.log('  ✓ v0.2 풀 재초기화 완료')
  console.log('═'.repeat(56))
  const summary = results.map(r => ({
    pool:       r.pool,
    newTokenId: r.newTokenId.toString(),
    liquidity:  r.liquidity.toString(),
    amount0:    ethers.formatUnits(r.amount0, 18),
    amount1:    ethers.formatUnits(r.amount1, 18),
  }))
  console.log(JSON.stringify(summary, null, 2))

  // 결과 파일 저장
  const outPath = path.join(__dirname, '..', 'reinitialize-result.json')
  fs.writeFileSync(outPath, JSON.stringify({
    reinitializedAt: new Date().toISOString(),
    rates: { USDKRW: 1495, USDJPY: 157.8, USDEUR: 1.171, KRWJPY: 0.1055 },
    positions: summary,
  }, null, 2))
  console.log(`\n결과 저장: scripts/v3-deploy/reinitialize-result.json`)
}

main().catch(err => {
  console.error('\n[실패]', err)
  process.exit(1)
})

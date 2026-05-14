import { ethers } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

// ── 주소 상수 ─────────────────────────────────────────────────────────────────
const POSITION_MANAGER = '0x245a9b3937b28cfAE315D9E498ae46A758652Ad1'
const SWAP_ROUTER      = '0x8920e24184Ae7a1D55d64ef42f319139E9A72885'
const OWNER            = '0x069331CB8ADC2E376f0A2F8a6CDDee4f021e07cD'

const TOKEN = {
  TUSD: '0x6e13fac4f535d6727668fc6e2e724bfb52b6e274',
  TKRW: '0x244e7f6ae105430cd3260e5d869fb0625d5c4d0c',
  TJPY: '0xe9a2be5da45a4e677327cb8ae0bf9195d7e679d8',
  TEUR: '0xe7b1040376e005ce0fa8b5914d00adbf6e4cc99d',
} as const

// ── 풀 설정 ───────────────────────────────────────────────────────────────────
// 실환율 2026-05-14 기준: USDKRW 1495, USDJPY 157.8, USDEUR 1.171, KRWJPY 0.1055
//
// price = token1 / token0  (token0 < token1 주소 오름차순)
// token ordering (주소 hex 오름차순):
//   TKRW(0x244e) < TUSD(0x6e13) < TEUR(0xe7b1) < TJPY(0xe9a2)
//
//   TKRW/TUSD → token0=TKRW, token1=TUSD, price = TUSD/TKRW = 1/1495
//   TUSD/TJPY → token0=TUSD, token1=TJPY, price = TJPY/TUSD = 157.8
//   TUSD/TEUR → token0=TUSD, token1=TEUR, price = TEUR/TUSD = 1/1.171
//   TKRW/TJPY → token0=TKRW, token1=TJPY, price = TJPY/TKRW = 0.1055

interface PoolConfig {
  address:   string
  tokenId:   number    // 기존 NonfungiblePositionManager tokenId (회수 대상)
  token0:    string    // 주소 작은 쪽
  token1:    string    // 주소 큰 쪽
  fee:       number    // 500 (0.05%)
  price:     number    // token1/token0 (18 decimals 동일 기준)
  rangePct:  number    // ±% tick 범위
  amount0:   bigint    // 최종 mint 시 공급량
  amount1:   bigint
}

const TICK_SPACING = 10  // fee=500 풀

const POOLS: PoolConfig[] = [
  {
    // TKRW/TUSD — price = TUSD per TKRW = 1/1495 ≈ 0.0006689
    address:  '0x1DE1642256DD4F479C60975C0F12a861DF499b1e',
    tokenId:  1,
    token0:   TOKEN.TKRW,
    token1:   TOKEN.TUSD,
    fee:      500,
    price:    1 / 1495,
    rangePct: 10,
    amount0:  ethers.parseUnits('14900000', 18),  // 14.9M TKRW (~$10k)
    amount1:  ethers.parseUnits('9970',     18),  // ~$10k TUSD
  },
  {
    // TUSD/TJPY — price = TJPY per TUSD = 157.8
    address:  '0x789C1b717d9291781256472Ccf6Fe3d04208DB35',
    tokenId:  2,
    token0:   TOKEN.TUSD,
    token1:   TOKEN.TJPY,
    fee:      500,
    price:    157.8,
    rangePct: 10,
    amount0:  ethers.parseUnits('9970',    18),  // ~$10k TUSD
    amount1:  ethers.parseUnits('1573266', 18),  // ~$10k TJPY
  },
  {
    // TUSD/TEUR — price = TEUR per TUSD = 1/1.171 ≈ 0.8540
    address:  '0xc98A7B66C51276E94D686a4e4C808ebb26Df6b76',
    tokenId:  3,
    token0:   TOKEN.TUSD,
    token1:   TOKEN.TEUR,
    fee:      500,
    price:    1 / 1.171,
    rangePct: 10,
    amount0:  ethers.parseUnits('9970', 18),  // ~$10k TUSD
    amount1:  ethers.parseUnits('8514', 18),  // ~$10k TEUR
  },
  {
    // TKRW/TJPY — price = TJPY per TKRW = 0.1055
    address:  '0xB7E99f032Ac4e24fd7B8E4330f1E9CECe207ceaA',
    tokenId:  4,
    token0:   TOKEN.TKRW,
    token1:   TOKEN.TJPY,
    fee:      500,
    price:    0.1055,
    rangePct: 10,
    amount0:  ethers.parseUnits('14900000', 18),  // ~$10k 상당 TKRW
    amount1:  ethers.parseUnits('1571950',  18),  // ~$10k 상당 TJPY
  },
]

// ── ABIs ─────────────────────────────────────────────────────────────────────
const ABIS_DIR = path.join(__dirname, '..', 'abis')

function loadAbi(file: string): ethers.InterfaceAbi {
  return JSON.parse(
    fs.readFileSync(path.join(ABIS_DIR, file), 'utf-8')
  ) as ethers.InterfaceAbi
}

const POOL_ABI   = loadAbi('abi_v3pool.json')
const PM_ABI     = loadAbi('abi_positionmanager.json')
const ROUTER_ABI = loadAbi('abi_swaprouter.json')

// ── 수학 헬퍼 ─────────────────────────────────────────────────────────────────
// sqrtPriceX96 = sqrt(price) * 2^96   (price = token1/token0, 동일 decimals)
function priceToSqrtPriceX96(price: number): bigint {
  const sqrtPrice = Math.sqrt(price)
  const Q96       = 2n ** 96n
  const SCALE     = BigInt(1e18)
  const sqrtScaled = BigInt(Math.round(sqrtPrice * 1e18))
  return (sqrtScaled * Q96) / SCALE
}

// sqrtPriceX96 → price
function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
  const Q96   = 2n ** 96n
  const SCALE = BigInt(1e12)
  return Number(sqrtPriceX96 * sqrtPriceX96 * SCALE / (Q96 * Q96)) / 1e12
}

// price → tick (floor)
function priceToTick(price: number): number {
  return Math.floor(Math.log(price) / Math.log(1.0001))
}

function roundTick(tick: number, spacing: number): number {
  return Math.round(tick / spacing) * spacing
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

// ── ERC20 헬퍼 ───────────────────────────────────────────────────────────────
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
]

async function ensureApprove(
  tokenAddr: string,
  spender: string,
  amount: bigint,
  signer: ethers.Signer
) {
  const token     = new ethers.Contract(tokenAddr, ERC20_ABI, signer)
  const owner     = await signer.getAddress()
  const allowance = await token.allowance(owner, spender) as bigint
  if (allowance < amount) {
    console.log(`    approve ${tokenAddr.slice(0, 10)}...`)
    const tx = await token.approve(spender, ethers.MaxUint256)
    await tx.wait()
  }
}

async function getBalance(tokenAddr: string, owner: string, signer: ethers.Signer): Promise<bigint> {
  const token = new ethers.Contract(tokenAddr, ERC20_ABI, signer)
  return await token.balanceOf(owner) as bigint
}

// ── ① 유동성 전량 회수 ────────────────────────────────────────────────────────
async function withdrawPosition(
  pm: ethers.Contract,
  cfg: PoolConfig,
  signer: ethers.Signer
): Promise<{ hadLiquidity: boolean }> {
  const owner = await signer.getAddress()
  console.log(`\n[Step 1] tokenId=${cfg.tokenId} 유동성 회수`)

  // 소유권 확인 — burn 완료된 tokenId는 ownerOf 자체가 revert됨
  try {
    const tokenOwner = await pm.ownerOf(cfg.tokenId) as string
    if (tokenOwner.toLowerCase() !== owner.toLowerCase()) {
      console.log(`  ⚠️  tokenId=${cfg.tokenId} 소유자가 다름 (${tokenOwner}) — 스킵`)
      return { hadLiquidity: false }
    }
  } catch {
    console.log(`  ⚠️  tokenId=${cfg.tokenId} ownerOf 실패 — 이미 burn됨, 스킵`)
    return { hadLiquidity: false }
  }

  // positions() 조회
  let pos: { liquidity: bigint; tickLower: bigint; tickUpper: bigint }
  try {
    pos = await pm.positions(cfg.tokenId) as typeof pos
  } catch {
    console.log(`  ⚠️  tokenId=${cfg.tokenId} positions 조회 실패 — 스킵`)
    return { hadLiquidity: false }
  }

  console.log(`  liquidity : ${pos.liquidity}`)
  console.log(`  tickRange : [${pos.tickLower}, ${pos.tickUpper}]`)

  const hadLiquidity = pos.liquidity > 0n

  if (hadLiquidity) {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800)
    const tx1 = await withRetry(
      () => pm.decreaseLiquidity({
        tokenId:    cfg.tokenId,
        liquidity:  pos.liquidity,
        amount0Min: 0n,
        amount1Min: 0n,
        deadline,
      }),
      `decreaseLiquidity ${cfg.tokenId}`
    )
    const r1 = await tx1.wait()
    console.log(`  ✓ decreaseLiquidity: ${r1.hash}`)
  } else {
    console.log(`  유동성 없음 — decreaseLiquidity 스킵`)
  }

  // tokensOwed가 있으면 collect
  const MAX128 = (1n << 128n) - 1n
  const tx2 = await withRetry(
    () => pm.collect({
      tokenId:    cfg.tokenId,
      recipient:  owner,
      amount0Max: MAX128,
      amount1Max: MAX128,
    }),
    `collect ${cfg.tokenId}`
  )
  const r2 = await tx2.wait()
  console.log(`  ✓ collect: ${r2.hash}`)

  // NFT burn
  const tx3 = await withRetry(() => pm.burn(cfg.tokenId), `burn ${cfg.tokenId}`)
  const r3 = await tx3.wait()
  console.log(`  ✓ burn: ${r3.hash}`)

  return { hadLiquidity }
}

// ── ② 풀 가격 조정 (스왑) ────────────────────────────────────────────────────
// 유동성이 0인 상태에서는 스왑 불가.
// → 소량 seed 유동성 추가 → 스왑 → seed 유동성 제거 → 본 mint
async function adjustPoolPrice(
  pm: ethers.Contract,
  pool: ethers.Contract,
  router: ethers.Contract,
  cfg: PoolConfig,
  signer: ethers.Signer
): Promise<void> {
  const owner = await signer.getAddress()

  // 현재 가격 읽기
  const slot0 = await pool.slot0() as { sqrtPriceX96: bigint; tick: bigint; liquidity: bigint }
  const currentPrice = sqrtPriceX96ToPrice(slot0.sqrtPriceX96)
  const targetPrice  = cfg.price
  const diffPct      = Math.abs(currentPrice - targetPrice) / targetPrice * 100

  console.log(`\n[Step 2] 풀 가격 조정`)
  console.log(`  현재 price : ${currentPrice.toFixed(8)}  tick=${slot0.tick}`)
  console.log(`  목표 price : ${targetPrice.toFixed(8)}`)
  console.log(`  괴리율     : ${diffPct.toFixed(3)}%`)

  if (diffPct < 0.5) {
    console.log(`  ✓ 괴리율 허용 범위 내 — 스왑 스킵`)
    return
  }

  // 현재 풀 전체 유동성 확인
  const poolLiquidity = await pool.liquidity() as bigint
  console.log(`  풀 유동성  : ${poolLiquidity}`)

  let seedTokenId: bigint | null = null

  if (poolLiquidity === 0n) {
    // 유동성이 없으면 스왑 불가 → 소량 seed 유동성 추가
    console.log(`  유동성 없음 — seed 유동성 추가 후 스왑`)
    seedTokenId = await mintSeed(pm, cfg, signer)
  }

  // 스왑 방향 결정 (price = token1/token0):
  //   zeroForOne=true  (token0→token1): pool에 token0 유입 → token0 공급 ↑ → price(token1/token0) 하락
  //   zeroForOne=false (token1→token0): pool에 token1 유입 → token1 공급 ↑ → price(token1/token0) 상승
  //
  //   currentPrice > targetPrice → price 낮춰야 함 → zeroForOne = true
  //   currentPrice < targetPrice → price 높여야 함 → zeroForOne = false
  const zeroForOne = currentPrice > targetPrice

  // 스왑할 amountIn: 목표 가격 이동에 필요한 수량을 보수적으로 산정
  // price 이동 비율에 비례하여 풀 깊이의 일정 배수를 투입
  // 단, 유동성 없는 상태에서 seed만 있을 경우 seed량의 80% 투입
  const SWAP_SCALE = 5n   // 목표 달성 여유분 (실제 이동량 < 투입량이므로 넉넉하게)
  let amountIn: bigint

  if (zeroForOne) {
    // token0 → token1: token0 잔액의 일부 사용
    const bal = await getBalance(cfg.token0, owner, signer)
    amountIn = bal / 2n
  } else {
    // token1 → token0: token1 잔액의 일부 사용
    const bal = await getBalance(cfg.token1, owner, signer)
    amountIn = bal / 2n
  }

  if (amountIn === 0n) {
    console.warn(`  ⚠️  스왑용 잔액 없음 — 스왑 스킵`)
  } else {
    const tokenIn  = zeroForOne ? cfg.token0 : cfg.token1
    const tokenOut = zeroForOne ? cfg.token1 : cfg.token0

    // sqrtPriceLimitX96: 스왑이 목표 가격에 도달하면 멈추도록 설정
    const sqrtPriceLimit = priceToSqrtPriceX96(targetPrice)

    await ensureApprove(tokenIn, await router.getAddress(), amountIn * SWAP_SCALE, signer)

    console.log(`  스왑: ${zeroForOne ? 'token0→token1' : 'token1→token0'}  amountIn=${ethers.formatUnits(amountIn, 18)}`)

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800)
    const swapTx = await withRetry(
      () => router.exactInputSingle({
        tokenIn,
        tokenOut,
        fee:               cfg.fee,
        recipient:         owner,
        deadline,
        amountIn,
        amountOutMinimum:  0n,
        sqrtPriceLimitX96: sqrtPriceLimit,
      }),
      `swap ${cfg.address.slice(0, 10)}`
    )
    const swapR = await swapTx.wait()
    console.log(`  ✓ swap: ${swapR.hash}`)

    // 스왑 후 가격 확인
    const slot0After = await pool.slot0() as { sqrtPriceX96: bigint; tick: bigint }
    const priceAfter = sqrtPriceX96ToPrice(slot0After.sqrtPriceX96)
    const diffAfter  = Math.abs(priceAfter - targetPrice) / targetPrice * 100
    console.log(`  스왑 후 price : ${priceAfter.toFixed(8)}  tick=${slot0After.tick}  괴리=${diffAfter.toFixed(3)}%`)
  }

  // seed 유동성 제거
  if (seedTokenId !== null) {
    await removeSeed(pm, seedTokenId, owner)
  }
}

// ── seed 유동성 추가 (스왑 가능하게 최소 유동성 확보) ──────────────────────────
async function mintSeed(
  pm: ethers.Contract,
  cfg: PoolConfig,
  signer: ethers.Signer
): Promise<bigint> {
  const owner = await signer.getAddress()

  // 목표 가격 기준 ±50% 넓은 범위로 seed 추가 (스왑 시 가격 이동 공간 확보)
  const seedRangePct = 50
  const lowerPrice   = cfg.price * (1 - seedRangePct / 100)
  const upperPrice   = cfg.price * (1 + seedRangePct / 100)
  const tickLower    = roundTick(priceToTick(lowerPrice), TICK_SPACING)
  const tickUpper    = roundTick(priceToTick(upperPrice), TICK_SPACING)

  // seed 수량: 본 mint의 1%
  const seed0 = cfg.amount0 / 100n
  const seed1 = cfg.amount1 / 100n

  console.log(`  [seed mint] tickRange=[${tickLower}, ${tickUpper}]  seed0=${ethers.formatUnits(seed0, 18)}  seed1=${ethers.formatUnits(seed1, 18)}`)

  await ensureApprove(cfg.token0, await pm.getAddress(), seed0, signer)
  await ensureApprove(cfg.token1, await pm.getAddress(), seed1, signer)

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800)
  const tx = await withRetry(
    () => pm.mint({
      token0:         cfg.token0,
      token1:         cfg.token1,
      fee:            cfg.fee,
      tickLower,
      tickUpper,
      amount0Desired: seed0,
      amount1Desired: seed1,
      amount0Min:     0n,
      amount1Min:     0n,
      recipient:      owner,
      deadline,
    }),
    `seed mint ${cfg.address.slice(0, 10)}`
  )
  const receipt = await tx.wait()
  console.log(`  ✓ seed mint: ${receipt.hash}`)

  const iface  = pm.interface
  const mintLog = receipt.logs
    .map((log: ethers.Log) => { try { return iface.parseLog(log) } catch { return null } })
    .find((e: ethers.LogDescription | null) => e?.name === 'IncreaseLiquidity')

  if (!mintLog) throw new Error('seed IncreaseLiquidity 이벤트 없음')
  console.log(`  seed tokenId=${mintLog.args.tokenId}`)
  return mintLog.args.tokenId as bigint
}

// ── seed 유동성 제거 ──────────────────────────────────────────────────────────
async function removeSeed(
  pm: ethers.Contract,
  seedTokenId: bigint,
  owner: string
): Promise<void> {
  console.log(`  [seed remove] tokenId=${seedTokenId}`)

  const pos = await pm.positions(seedTokenId) as { liquidity: bigint }

  if (pos.liquidity > 0n) {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800)
    const tx1 = await withRetry(
      () => pm.decreaseLiquidity({
        tokenId:    seedTokenId,
        liquidity:  pos.liquidity,
        amount0Min: 0n,
        amount1Min: 0n,
        deadline,
      }),
      `seed decreaseLiquidity`
    )
    await tx1.wait()
  }

  const MAX128 = (1n << 128n) - 1n
  const tx2 = await withRetry(
    () => pm.collect({
      tokenId:    seedTokenId,
      recipient:  owner,
      amount0Max: MAX128,
      amount1Max: MAX128,
    }),
    `seed collect`
  )
  await tx2.wait()

  const tx3 = await withRetry(() => pm.burn(seedTokenId), `seed burn`)
  await tx3.wait()
  console.log(`  ✓ seed 제거 완료`)
}

// ── ③ 본 유동성 mint ──────────────────────────────────────────────────────────
async function mintPosition(
  pm: ethers.Contract,
  cfg: PoolConfig,
  signer: ethers.Signer
): Promise<{ tokenId: bigint; liquidity: bigint; amount0: bigint; amount1: bigint }> {
  const owner = await signer.getAddress()

  const lowerPrice = cfg.price * (1 - cfg.rangePct / 100)
  const upperPrice = cfg.price * (1 + cfg.rangePct / 100)
  const tickLower  = roundTick(priceToTick(lowerPrice), TICK_SPACING)
  const tickUpper  = roundTick(priceToTick(upperPrice), TICK_SPACING)
  const tickCenter = priceToTick(cfg.price)

  console.log(`\n[Step 3] 유동성 mint`)
  console.log(`  price     : ${cfg.price}`)
  console.log(`  tickRange : [${tickLower}, ${tickCenter}, ${tickUpper}]`)
  console.log(`  amount0   : ${ethers.formatUnits(cfg.amount0, 18)}`)
  console.log(`  amount1   : ${ethers.formatUnits(cfg.amount1, 18)}`)

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
  console.log(`  ✓ mint: ${receipt.hash}`)

  const iface   = pm.interface
  const mintLog = receipt.logs
    .map((log: ethers.Log) => { try { return iface.parseLog(log) } catch { return null } })
    .find((e: ethers.LogDescription | null) => e?.name === 'IncreaseLiquidity')

  if (!mintLog) throw new Error('IncreaseLiquidity 이벤트 없음')

  const { tokenId, liquidity, amount0, amount1 } = mintLog.args
  console.log(`  tokenId   : ${tokenId}`)
  console.log(`  liquidity : ${liquidity}`)
  console.log(`  amount0   : ${ethers.formatUnits(amount0, 18)}`)
  console.log(`  amount1   : ${ethers.formatUnits(amount1, 18)}`)

  return { tokenId, liquidity, amount0, amount1 }
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

  const pm     = new ethers.Contract(POSITION_MANAGER, PM_ABI,     signer)
  const router = new ethers.Contract(SWAP_ROUTER,      ROUTER_ABI, signer)

  const results: Array<{
    pool:       string
    newTokenId: string
    liquidity:  string
    amount0:    string
    amount1:    string
  }> = []

  for (const cfg of POOLS) {
    console.log('\n' + '═'.repeat(56))
    console.log(`풀: ${cfg.address}`)
    console.log(`목표 price (token1/token0): ${cfg.price}`)

    const pool = new ethers.Contract(cfg.address, POOL_ABI, signer)

    // ① 기존 유동성 전량 회수 (decreaseLiquidity → collect → burn)
    await withdrawPosition(pm, cfg, signer)

    // ② 스왑으로 풀 가격을 목표 환율로 이동
    //    유동성 0이면 seed mint → swap → seed remove 순으로 처리
    await adjustPoolPrice(pm, pool, router, cfg, signer)

    // ③ 새 환율 기준 ±rangePct% 범위로 본 유동성 mint
    const mintResult = await mintPosition(pm, cfg, signer)

    results.push({
      pool:       cfg.address,
      newTokenId: mintResult.tokenId.toString(),
      liquidity:  mintResult.liquidity.toString(),
      amount0:    ethers.formatUnits(mintResult.amount0, 18),
      amount1:    ethers.formatUnits(mintResult.amount1, 18),
    })
  }

  // ── 결과 요약 ─────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(56))
  console.log('  ✓ v0.2 풀 재초기화 완료')
  console.log('═'.repeat(56))
  console.log(JSON.stringify(results, null, 2))

  const outPath = path.join(__dirname, '..', 'reinitialize-result.json')
  fs.writeFileSync(outPath, JSON.stringify({
    reinitializedAt: new Date().toISOString(),
    rates: { USDKRW: 1495, USDJPY: 157.8, USDEUR: 1.171, KRWJPY: 0.1055 },
    positions: results,
  }, null, 2))
  console.log(`\n결과 저장: scripts/v3-deploy/reinitialize-result.json`)
}

main().catch(err => {
  console.error('\n[실패]', err)
  process.exit(1)
})

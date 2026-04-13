import { ethers } from 'hardhat'
import type { JsonFragment } from 'ethers'
import * as fs from 'fs'
import * as path from 'path'

// ── 경로 상수 ─────────────────────────────────────────────────────────────────
const NM = path.join(__dirname, '..', 'node_modules')

// 사전 컴파일 아티팩트 경로 (npm 패키지에 포함된 ABI + bytecode)
const ARTIFACT_PATHS = {
  UniswapV3Factory:
    '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json',
  NFTDescriptor:
    '@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json',
  NonfungibleTokenPositionDescriptor:
    '@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json',
  NonfungiblePositionManager:
    '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json',
  SwapRouter:
    '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json',
}

type ArtifactName = keyof typeof ARTIFACT_PATHS

interface Artifact {
  abi: JsonFragment[]
  bytecode: string
  linkReferences?: Record<string, Record<string, { start: number; length: number }[]>>
}

// ── 아티팩트 로드 ─────────────────────────────────────────────────────────────
function loadArtifact(name: ArtifactName): Artifact {
  const fullPath = path.join(NM, ARTIFACT_PATHS[name])
  if (!fs.existsSync(fullPath)) {
    throw new Error(`아티팩트 파일 없음: ${fullPath}`)
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as Artifact
}

// ── 라이브러리 링킹 ───────────────────────────────────────────────────────────
// NonfungibleTokenPositionDescriptor 바이트코드의 __$hash$__ 플레이스홀더를
// 실제 NFTDescriptor 라이브러리 주소로 교체한다.
function linkBytecode(
  artifact: Artifact,
  libraries: Record<string, string>
): string {
  let bytecode = artifact.bytecode

  if (!artifact.linkReferences) return bytecode

  for (const [, contracts] of Object.entries(artifact.linkReferences)) {
    for (const [contractName, offsets] of Object.entries(contracts)) {
      const libAddress = libraries[contractName]
      if (!libAddress) {
        throw new Error(`링킹 실패: 라이브러리 주소 없음 — ${contractName}`)
      }
      const addr = libAddress.toLowerCase().replace(/^0x/, '')
      if (addr.length !== 40) throw new Error(`잘못된 주소: ${libAddress}`)

      for (const { start, length } of offsets) {
        if (length !== 20) throw new Error(`예상치 못한 링크 길이: ${length}`)
        const hexStart = 2 + start * 2 // '0x' 건너뜀
        const hexEnd = hexStart + 40
        bytecode = bytecode.slice(0, hexStart) + addr + bytecode.slice(hexEnd)
      }
    }
  }

  return bytecode
}

// ── 재시도 래퍼 ──────────────────────────────────────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  retries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  [${label}] 시도 ${attempt}/${retries} 실패: ${msg}`)
      if (attempt === retries) throw err
      console.log(`  [${label}] 3초 후 재시도...`)
      await new Promise((r) => setTimeout(r, 3000))
    }
  }
  throw new Error('unreachable')
}

// ── 컨트랙트 배포 ─────────────────────────────────────────────────────────────
async function deployContract(
  name: ArtifactName,
  args: unknown[],
  options: { libraries?: Record<string, string> } = {}
): Promise<{ address: string; abi: JsonFragment[] }> {
  console.log(`\n[${name}] 배포 시작...`)
  const artifact = loadArtifact(name)
  const bytecode = options.libraries
    ? linkBytecode(artifact, options.libraries)
    : artifact.bytecode

  // 링킹 후 플레이스홀더가 남아있으면 에러
  if (/__\$[0-9a-f]{34}\$__/.test(bytecode)) {
    throw new Error(`[${name}] 미해결 라이브러리 플레이스홀더가 남아있습니다`)
  }

  const factory = new ethers.ContractFactory(artifact.abi, bytecode)
  const [signer] = await ethers.getSigners()
  const connectedFactory = factory.connect(signer)

  const contract = await withRetry(
    () => connectedFactory.deploy(...args),
    `${name} deploy`
  )
  const txHash = contract.deploymentTransaction()?.hash ?? '(unknown)'
  console.log(`  tx: ${txHash}`)

  await withRetry(() => contract.waitForDeployment(), `${name} confirm`)

  const address = await contract.getAddress()
  console.log(`  ✓ ${name}: ${address}`)
  return { address, abi: artifact.abi }
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
const WKRC_ADDRESS = '0x0000000000000000000000000000000000001000'

async function main() {
  const [deployer] = await ethers.getSigners()
  const deployerAddress = await deployer.getAddress()
  const network = await ethers.provider.getNetwork()

  console.log('═'.repeat(52))
  console.log('  Uniswap V3 — StableNet Testnet 배포')
  console.log('═'.repeat(52))
  console.log(`  배포자  : ${deployerAddress}`)
  console.log(`  네트워크: (chainId: ${network.chainId})`)
  console.log(`  WKRC    : ${WKRC_ADDRESS}`)

  // ── 아티팩트 존재 확인 ──────────────────────────────────────────────────────
  console.log('\n[사전 확인] 아티팩트 파일 확인 중...')
  for (const name of Object.keys(ARTIFACT_PATHS) as ArtifactName[]) {
    loadArtifact(name) // 파일 없으면 여기서 throw
    console.log(`  ✓ ${name}`)
  }

  // ── ① UniswapV3Factory ──────────────────────────────────────────────────────
  const { address: factoryAddress } = await deployContract('UniswapV3Factory', [])

  // ── ② NFTDescriptor 라이브러리 ─────────────────────────────────────────────
  const { address: nftDescriptorAddress } = await deployContract('NFTDescriptor', [])

  // ── ③ NonfungibleTokenPositionDescriptor ───────────────────────────────────
  const nativeCurrencyLabel = ethers.encodeBytes32String('KRC')
  const { address: descriptorAddress } = await deployContract(
    'NonfungibleTokenPositionDescriptor',
    [WKRC_ADDRESS, nativeCurrencyLabel],
    { libraries: { NFTDescriptor: nftDescriptorAddress } }
  )

  // ── ④ NonfungiblePositionManager ───────────────────────────────────────────
  const { address: positionManagerAddress } = await deployContract(
    'NonfungiblePositionManager',
    [factoryAddress, WKRC_ADDRESS, descriptorAddress]
  )

  // ── ⑤ SwapRouter ───────────────────────────────────────────────────────────
  const { address: swapRouterAddress } = await deployContract(
    'SwapRouter',
    [factoryAddress, WKRC_ADDRESS]
  )

  // ── 결과 저장 ────────────────────────────────────────────────────────────────
  const result = {
    factory: factoryAddress,
    positionManager: positionManagerAddress,
    swapRouter: swapRouterAddress,
    descriptor: descriptorAddress,
    nftDescriptor: nftDescriptorAddress,
    deployer: deployerAddress,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
  }

  const outDir = path.join(__dirname, '..')
  const outPath = path.join(outDir, 'v3-deployments.json')
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2))
  console.log(`\n  결과 파일: v3-deployments.json`)

  // ── ABI 추출 ─────────────────────────────────────────────────────────────────
  const abisDir = path.join(outDir, 'abis')
  fs.mkdirSync(abisDir, { recursive: true })

  const abiTargets: { name: ArtifactName; file: string }[] = [
    { name: 'UniswapV3Factory', file: 'abi_v3factory.json' },
    { name: 'NonfungiblePositionManager', file: 'abi_positionmanager.json' },
    { name: 'SwapRouter', file: 'abi_swaprouter.json' },
  ]

  for (const { name, file } of abiTargets) {
    const { abi } = loadArtifact(name)
    fs.writeFileSync(path.join(abisDir, file), JSON.stringify(abi, null, 2))
    console.log(`  ABI 저장: abis/${file}`)
  }

  // ── 요약 ─────────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(52))
  console.log('  ✓ V3 배포 완료')
  console.log('═'.repeat(52))
  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error('\n[배포 실패]', err)
  process.exit(1)
})

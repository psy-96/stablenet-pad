/**
 * periphery-only 재배포 스크립트
 * - Factory는 재사용 (기존 v3-deployments.json에서 읽음)
 * - 재배포 대상: NFTDescriptor, PositionDescriptor, PositionManager, SwapRouter
 * - 완료 후 v3-deployments.json 업데이트
 */
import { ethers } from 'hardhat'
import type { JsonFragment } from 'ethers'
import * as fs from 'fs'
import * as path from 'path'

const ARTIFACTS_ROOT = path.join(__dirname, '..', '..', '..', 'artifacts', 'contracts', 'stablefi', 'v3')
const DEPLOYMENTS_PATH = path.join(__dirname, '..', 'v3-deployments.json')

const ARTIFACT_PATHS = {
  NFTDescriptor:
    'periphery/libraries/NFTDescriptor.sol/NFTDescriptor.json',
  StableFiNonfungibleTokenPositionDescriptor:
    'periphery/StableFiNonfungibleTokenPositionDescriptor.sol/StableFiNonfungibleTokenPositionDescriptor.json',
  StableFiNonfungiblePositionManager:
    'periphery/StableFiNonfungiblePositionManager.sol/StableFiNonfungiblePositionManager.json',
  StableFiV3SwapRouter:
    'periphery/StableFiV3SwapRouter.sol/StableFiV3SwapRouter.json',
} as const

type ArtifactName = keyof typeof ARTIFACT_PATHS

interface Artifact {
  abi: JsonFragment[]
  bytecode: string
  linkReferences?: Record<string, Record<string, { start: number; length: number }[]>>
}

function loadArtifact(name: ArtifactName): Artifact {
  const fullPath = path.join(ARTIFACTS_ROOT, ARTIFACT_PATHS[name])
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `[에러] 아티팩트 없음: ${fullPath}\n` +
      `  → 루트 프로젝트에서 먼저 컴파일하세요: npx hardhat compile`
    )
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as Artifact
}

function linkBytecode(artifact: Artifact, libraries: Record<string, string>): string {
  let bytecode = artifact.bytecode
  if (!artifact.linkReferences) return bytecode

  for (const [, contracts] of Object.entries(artifact.linkReferences)) {
    for (const [contractName, offsets] of Object.entries(contracts)) {
      const libAddress = libraries[contractName]
      if (!libAddress) throw new Error(`링킹 실패: 라이브러리 주소 없음 — ${contractName}`)
      const addr = libAddress.toLowerCase().replace(/^0x/, '')
      if (addr.length !== 40) throw new Error(`잘못된 주소: ${libAddress}`)
      for (const { start, length } of offsets) {
        if (length !== 20) throw new Error(`예상치 못한 링크 길이: ${length}`)
        const hexStart = 2 + start * 2
        const hexEnd = hexStart + 40
        bytecode = bytecode.slice(0, hexStart) + addr + bytecode.slice(hexEnd)
      }
    }
  }
  return bytecode
}

async function withRetry<T>(fn: () => Promise<T>, label: string, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  [${label}] 시도 ${attempt}/${retries} 실패: ${msg}`)
      if (attempt === retries) throw err
      await new Promise((r) => setTimeout(r, 3000))
    }
  }
  throw new Error('unreachable')
}

async function deployContract(
  name: ArtifactName,
  args: unknown[],
  options: { libraries?: Record<string, string> } = {}
): Promise<{ address: string; abi: JsonFragment[] }> {
  console.log(`\n[${name}] 배포 시작...`)
  const artifact = loadArtifact(name)
  const bytecode = options.libraries ? linkBytecode(artifact, options.libraries) : artifact.bytecode

  if (/__\$[0-9a-f]{34}\$__/.test(bytecode)) {
    throw new Error(`[${name}] 미해결 라이브러리 플레이스홀더가 남아있습니다`)
  }

  const factory = new ethers.ContractFactory(artifact.abi, bytecode)
  const [signer] = await ethers.getSigners()
  const contract = await withRetry(() => factory.connect(signer).deploy(...args), `${name} deploy`)

  const txHash = contract.deploymentTransaction()?.hash ?? '(unknown)'
  console.log(`  tx: ${txHash}`)
  await withRetry(() => contract.waitForDeployment(), `${name} confirm`)

  const address = await contract.getAddress()
  console.log(`  ✓ ${name}: ${address}`)
  return { address, abi: artifact.abi }
}

const WKRC_ADDRESS = '0x0000000000000000000000000000000000001000'

async function main() {
  // 기존 deployments에서 factory 주소 읽기
  if (!fs.existsSync(DEPLOYMENTS_PATH)) {
    throw new Error(`v3-deployments.json 없음: ${DEPLOYMENTS_PATH}`)
  }
  const existing = JSON.parse(fs.readFileSync(DEPLOYMENTS_PATH, 'utf-8')) as Record<string, unknown>
  const factoryAddress = existing.factory as string
  if (!factoryAddress) throw new Error('v3-deployments.json에 factory 주소 없음')

  const [deployer] = await ethers.getSigners()
  const deployerAddress = await deployer.getAddress()
  const network = await ethers.provider.getNetwork()

  console.log('═'.repeat(60))
  console.log('  StableFi V3 — Periphery 재배포 (POOL_INIT_CODE_HASH 수정)')
  console.log('═'.repeat(60))
  console.log(`  배포자     : ${deployerAddress}`)
  console.log(`  네트워크   : chainId ${network.chainId}`)
  console.log(`  기존 Factory: ${factoryAddress}`)
  console.log(`  WKRC       : ${WKRC_ADDRESS}`)

  // ① NFTDescriptor 라이브러리
  const { address: nftDescriptorAddress } = await deployContract('NFTDescriptor', [])

  // ② StableFiNonfungibleTokenPositionDescriptor
  const nativeCurrencyLabel = ethers.encodeBytes32String('KRC')
  const { address: descriptorAddress } = await deployContract(
    'StableFiNonfungibleTokenPositionDescriptor',
    [WKRC_ADDRESS, nativeCurrencyLabel],
    { libraries: { NFTDescriptor: nftDescriptorAddress } }
  )

  // ③ StableFiNonfungiblePositionManager
  const { address: positionManagerAddress } = await deployContract(
    'StableFiNonfungiblePositionManager',
    [factoryAddress, WKRC_ADDRESS, descriptorAddress]
  )

  // ④ StableFiV3SwapRouter
  const { address: swapRouterAddress } = await deployContract(
    'StableFiV3SwapRouter',
    [factoryAddress, WKRC_ADDRESS]
  )

  // 결과 저장
  const result = {
    ...existing,
    positionManager: positionManagerAddress,
    swapRouter: swapRouterAddress,
    descriptor: descriptorAddress,
    nftDescriptor: nftDescriptorAddress,
    deployer: deployerAddress,
    chainId: Number(network.chainId),
    redeployedAt: new Date().toISOString(),
  }

  fs.writeFileSync(DEPLOYMENTS_PATH, JSON.stringify(result, null, 2))

  // ABI 업데이트
  const abisDir = path.join(__dirname, '..', 'abis')
  fs.mkdirSync(abisDir, { recursive: true })

  const abiTargets: { name: ArtifactName; file: string }[] = [
    { name: 'StableFiNonfungiblePositionManager', file: 'abi_positionmanager.json' },
    { name: 'StableFiV3SwapRouter', file: 'abi_swaprouter.json' },
  ]
  for (const { name, file } of abiTargets) {
    const { abi } = loadArtifact(name)
    fs.writeFileSync(path.join(abisDir, file), JSON.stringify(abi, null, 2))
  }

  console.log('\n' + '═'.repeat(60))
  console.log('  ✓ Periphery 재배포 완료')
  console.log('═'.repeat(60))
  console.log(JSON.stringify({
    factory: factoryAddress,
    nftDescriptor: nftDescriptorAddress,
    descriptor: descriptorAddress,
    positionManager: positionManagerAddress,
    swapRouter: swapRouterAddress,
  }, null, 2))
}

main().catch((err) => {
  console.error('\n[재배포 실패]', err)
  process.exit(1)
})

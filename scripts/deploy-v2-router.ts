/**
 * StableFi V2 Router 단독 재배포 스크립트
 * Factory는 기존 주소를 사용하고 Router만 재배포한다.
 *
 * 실행:
 *   npx hardhat run scripts/deploy-v2-router.ts --network stablenet
 */
import hre from 'hardhat'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const { ethers, network } = hre

const FACTORY = '0xEf0C7E20fc70aCfB32C5D45C7c07FC82Ac00f2C8'
const WKRC = '0x0000000000000000000000000000000000001000'

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('=== StableFi V2 Router 재배포 ===')
  console.log('Network:', network.name, '| ChainId:', network.config.chainId)
  console.log('Deployer:', deployer.address)
  console.log('Factory:', FACTORY)
  console.log('WKRC:', WKRC)

  const balance = await ethers.provider.getBalance(deployer.address)
  console.log('Balance:', ethers.formatEther(balance), 'WKRC\n')

  const Router = await ethers.getContractFactory(
    'contracts/stablefi/v2/periphery/StableFiV2Router02.sol:StableFiV2Router02',
  )
  const router = await Router.deploy(FACTORY, WKRC, { gasLimit: 6_000_000 })
  const receipt = await router.deploymentTransaction()?.wait()
  const routerAddress = await router.getAddress()

  console.log('새 Router 주소:', routerAddress)
  console.log('tx hash:', receipt?.hash)
  console.log('block:', receipt?.blockNumber)
  console.log('gasUsed:', receipt?.gasUsed?.toString(), '\n')

  // ABI: 컴파일된 artifact에서 읽기
  const artifactPath = join(
    __dirname,
    '../artifacts/contracts/stablefi/v2/periphery/StableFiV2Router02.sol/StableFiV2Router02.json',
  )
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8')) as { abi: unknown[] }

  // deployments/ 저장
  const addrSuffix = routerAddress.slice(2, 10).toLowerCase()
  const outDir = join(__dirname, '../deployments/stablenet-testnet/production/StableFiV2Router02')
  mkdirSync(outDir, { recursive: true })

  const deployment = {
    contractName: 'StableFiV2Router02',
    type: 'StableFiV2Router02',
    network: 'stablenet-testnet',
    chainId: network.config.chainId,
    proxyAddress: null,
    implementationAddress: routerAddress,
    previousProxyAddress: null,
    constructorArgs: { factory: FACTORY, WKRC },
    abi: artifact.abi,
    txHash: receipt?.hash ?? null,
    blockNumber: receipt?.blockNumber ?? null,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  }

  const deploymentPath = join(outDir, `StableFiV2Router02_${addrSuffix}.json`)
  writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2) + '\n')
  console.log('Deployment JSON 저장:', deploymentPath)

  // scripts/v2-deployments.json 업데이트
  const v2DepPath = join(__dirname, 'v2-deployments.json')
  const existing = JSON.parse(readFileSync(v2DepPath, 'utf-8')) as Record<string, unknown>
  existing.router = routerAddress
  existing.routerTxHash = receipt?.hash ?? null
  existing.routerBlock = receipt?.blockNumber ?? null
  existing.routerDeployedAt = new Date().toISOString()
  writeFileSync(v2DepPath, JSON.stringify(existing, null, 2) + '\n')
  console.log('v2-deployments.json 업데이트 완료')

  console.log('\n=== 완료 ===')
  console.log('새 Router 주소:', routerAddress)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

/**
 * StableFi V2 배포 스크립트 (StableNet Testnet)
 *
 * 실행 전: hardhat.config.ts → paths.sources를 './contracts/stablefi/v2' 로 변경
 * 실행 후: hardhat.config.ts → paths.sources를 './contracts/templates' 로 원복
 *
 * 실행:
 *   npx hardhat run scripts/deploy-v2.ts --network stablenet
 */
import hre from 'hardhat'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const { ethers, network } = hre

const WKRC = '0x0000000000000000000000000000000000001000'
// keccak256(StableFiV2Pair.creationCode) — Router02 pairFor()와 반드시 일치해야 함
const INIT_CODE_HASH = '0x4c537bbb9708caa7dc2fa3085ee5980b7db976c8254aed5a105597c870064995'

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('=== StableFi V2 Deploy ===')
  console.log('Network:', network.name, '| ChainId:', network.config.chainId)
  console.log('Deployer:', deployer.address)

  const balance = await ethers.provider.getBalance(deployer.address)
  console.log('Balance:', ethers.formatEther(balance), 'WKRC\n')

  // --- 1. StableFiV2Factory 배포 ---
  console.log('--- [1/2] StableFiV2Factory 배포 ---')
  const Factory = await ethers.getContractFactory('contracts/stablefi/v2/core/StableFiV2Factory.sol:StableFiV2Factory')
  const factory = await Factory.deploy(deployer.address, { gasLimit: 6_000_000 })
  const factoryReceipt = await factory.deploymentTransaction()?.wait()
  const factoryAddress = await factory.getAddress()

  console.log('Factory 주소:', factoryAddress)
  console.log('tx hash:', factoryReceipt?.hash)
  console.log('block:', factoryReceipt?.blockNumber)
  console.log('gasUsed:', factoryReceipt?.gasUsed?.toString(), '\n')

  // --- 2. StableFiV2Router02 배포 ---
  console.log('--- [2/2] StableFiV2Router02 배포 ---')
  const Router = await ethers.getContractFactory('contracts/stablefi/v2/periphery/StableFiV2Router02.sol:StableFiV2Router02')
  const router = await Router.deploy(factoryAddress, WKRC, { gasLimit: 6_000_000 })
  const routerReceipt = await router.deploymentTransaction()?.wait()
  const routerAddress = await router.getAddress()

  console.log('Router 주소:', routerAddress)
  console.log('tx hash:', routerReceipt?.hash)
  console.log('block:', routerReceipt?.blockNumber)
  console.log('gasUsed:', routerReceipt?.gasUsed?.toString(), '\n')

  // --- 결과 저장 ---
  const result = {
    factory: factoryAddress,
    router: routerAddress,
    WKRC,
    factoryTxHash: factoryReceipt?.hash ?? null,
    routerTxHash: routerReceipt?.hash ?? null,
    factoryBlock: factoryReceipt?.blockNumber ?? null,
    routerBlock: routerReceipt?.blockNumber ?? null,
    deployer: deployer.address,
    chainId: network.config.chainId,
    deployedAt: new Date().toISOString(),
  }

  const outPath = join(__dirname, 'v2-deployments.json')
  writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n')
  console.log('=== 결과 저장:', outPath, '===')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

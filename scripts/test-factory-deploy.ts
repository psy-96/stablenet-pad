import hre from 'hardhat'
const { ethers, network } = hre

const PAIR_IMPLEMENTATION = '0xf57283a136463f6c27daa5e55215a1102e355d75'

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Network:', network.name, '| ChainId:', network.config.chainId)
  console.log('Deployer:', deployer.address)

  const balance = await ethers.provider.getBalance(deployer.address)
  console.log('Balance:', ethers.formatEther(balance), 'WKRC')

  // bytecode 사이즈 확인
  const factory = await ethers.getContractFactory('SimpleFactory')
  const bytecode = factory.bytecode
  console.log('Bytecode size (creationCode):', (bytecode.length - 2) / 2, 'bytes')

  // eth_estimateGas 먼저 시도
  console.log('\n--- eth_estimateGas 시도 ---')
  try {
    const deployTx = await factory.getDeployTransaction(
      deployer.address,
      PAIR_IMPLEMENTATION,
    )
    const estimated = await ethers.provider.estimateGas({
      from: deployer.address,
      data: deployTx.data,
    })
    console.log('estimateGas 성공:', estimated.toString())
  } catch (err: unknown) {
    const e = err as Error & { data?: string; reason?: string }
    console.log('estimateGas 실패:')
    console.log('  message:', e.message)
    if (e.data) console.log('  data:', e.data)
    if (e.reason) console.log('  reason:', e.reason)
  }

  // 실제 배포 시도
  console.log('\n--- 배포 시도 (gas: 6,000,000) ---')
  try {
    const deployedFactory = await factory.deploy(
      deployer.address,
      PAIR_IMPLEMENTATION,
      { gasLimit: 6_000_000 }
    )
    const receipt = await deployedFactory.deploymentTransaction()?.wait()
    console.log('배포 성공!')
    console.log('주소:', await deployedFactory.getAddress())
    console.log('tx hash:', receipt?.hash)
    console.log('status:', receipt?.status)
    console.log('gasUsed:', receipt?.gasUsed?.toString())
  } catch (err: unknown) {
    const e = err as Error & { data?: string; reason?: string; receipt?: { status: number; hash: string; gasUsed: bigint } }
    console.log('배포 실패:')
    console.log('  message:', e.message)
    if (e.data) console.log('  data (revert):', e.data)
    if (e.reason) console.log('  reason:', e.reason)
    if (e.receipt) {
      console.log('  receipt.status:', e.receipt.status)
      console.log('  receipt.hash:', e.receipt.hash)
      console.log('  receipt.gasUsed:', e.receipt.gasUsed?.toString())
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

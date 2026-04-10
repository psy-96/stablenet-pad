import hre from 'hardhat'
const { ethers, network } = hre

const PAIR_IMPLEMENTATION = '0xf57283a136463f6c27daa5e55215a1102e355d75'

interface TxError {
  message: string
  data?: string
  reason?: string
  receipt?: { status: number; hash: string; gasUsed: bigint }
}

async function deployContract(factory: Awaited<ReturnType<typeof ethers.getContractFactory>>, args: unknown[], label: string, gasLimit = 2_000_000) {
  console.log(`\n[배포] ${label}...`)
  try {
    const deployTx = await factory.getDeployTransaction(...args)
    const estimated = await ethers.provider.estimateGas({
      from: (await ethers.getSigners())[0].address,
      data: deployTx.data,
    })
    console.log(`  estimateGas: ${estimated.toString()}`)
  } catch (e) {
    const err = e as TxError
    console.log(`  estimateGas 실패: ${err.message}`)
    if (err.data) console.log(`  revert data: ${err.data}`)
  }

  const deployed = await factory.deploy(...args, { gasLimit })
  const receipt = await deployed.deploymentTransaction()?.wait()
  const addr = await deployed.getAddress()
  console.log(`  주소: ${addr}`)
  console.log(`  tx: ${receipt?.hash}`)
  console.log(`  status: ${receipt?.status === 1 ? '✓ success' : '✗ FAILED'}`)
  console.log(`  gasUsed: ${receipt?.gasUsed?.toString()}`)
  if (receipt?.status !== 1) throw new Error(`${label} 배포 실패 (status 0)`)
  return { contract: deployed, address: addr }
}

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('=== StableNet CREATE2 / createPair 테스트 ===')
  console.log(`Network: ${network.name} | ChainId: ${network.config.chainId}`)
  console.log(`Deployer: ${deployer.address}`)
  const balance = await ethers.provider.getBalance(deployer.address)
  console.log(`Balance: ${ethers.formatEther(balance)} WKRC`)
  console.log(`pairImplementation: ${PAIR_IMPLEMENTATION}`)

  // ── 1. MockERC20 × 2 배포 ──────────────────────────────────────────────────
  const erc20Factory = await ethers.getContractFactory('MockERC20')

  const { address: tokenAAddr } = await deployContract(
    erc20Factory,
    ['TokenA', 'TKA', 1_000_000],
    'MockERC20 (TokenA)',
  )
  const { address: tokenBAddr } = await deployContract(
    erc20Factory,
    ['TokenB', 'TKB', 1_000_000],
    'MockERC20 (TokenB)',
  )

  console.log(`\n  TokenA: ${tokenAAddr}`)
  console.log(`  TokenB: ${tokenBAddr}`)

  // ── 2. FactoryWithPair 배포 ────────────────────────────────────────────────
  const factoryFactory = await ethers.getContractFactory('FactoryWithPair')
  const { contract: factoryContract, address: factoryAddr } = await deployContract(
    factoryFactory,
    [PAIR_IMPLEMENTATION],
    'FactoryWithPair',
    3_000_000,
  )
  console.log(`\n  Factory: ${factoryAddr}`)

  // ── 3. createPair() 호출 ───────────────────────────────────────────────────
  console.log('\n=== createPair() 호출 ===')
  console.log(`  tokenA: ${tokenAAddr}`)
  console.log(`  tokenB: ${tokenBAddr}`)
  console.log(`  gasLimit: 6,000,000`)

  // estimateGas 먼저
  try {
    const calldata = factoryContract.interface.encodeFunctionData('createPair', [tokenAAddr, tokenBAddr])
    const estGas = await ethers.provider.estimateGas({
      from: deployer.address,
      to: factoryAddr,
      data: calldata,
    })
    console.log(`  createPair estimateGas: ${estGas.toString()}`)
  } catch (e) {
    const err = e as TxError
    console.log(`  createPair estimateGas 실패: ${err.message}`)
    if (err.data) console.log(`  revert data: ${err.data}`)
    if (err.reason) console.log(`  reason: ${err.reason}`)
  }

  // 실제 호출
  try {
    const tx = await factoryContract.createPair(tokenAAddr, tokenBAddr, { gasLimit: 6_000_000 })
    const receipt = await tx.wait()
    console.log(`\n  ✓ createPair 성공!`)
    console.log(`  tx: ${receipt.hash}`)
    console.log(`  status: ${receipt.status}`)
    console.log(`  gasUsed: ${receipt.gasUsed.toString()}`)

    // PairCreated 이벤트 파싱
    const pairCreatedTopic = factoryContract.interface.getEvent('PairCreated')?.topicHash
    const log = receipt.logs.find((l: { topics: string[] }) => l.topics[0] === pairCreatedTopic)
    if (log) {
      const parsed = factoryContract.interface.parseLog(log)
      console.log(`\n  [이벤트] PairCreated`)
      console.log(`    token0: ${parsed?.args.token0 as string}`)
      console.log(`    token1: ${parsed?.args.token1 as string}`)
      console.log(`    pair:   ${parsed?.args.pair as string}`)
      console.log(`    length: ${(parsed?.args[3] as bigint).toString()}`)

      // allPairs 확인
      const pairAddr = parsed?.args.pair as string
      const allLen = await factoryContract.allPairsLength()
      console.log(`\n  allPairs.length: ${allLen.toString()}`)
      console.log(`  getPair[A][B]:   ${(await factoryContract.getPair(tokenAAddr, tokenBAddr)) as string}`)
      console.log(`  getPair[B][A]:   ${(await factoryContract.getPair(tokenBAddr, tokenAAddr)) as string}`)
    } else {
      console.log('  (PairCreated 이벤트 없음)')
    }
  } catch (e) {
    const err = e as TxError
    console.log(`\n  ✗ createPair 실패`)
    console.log(`  message: ${err.message}`)
    if (err.data) console.log(`  revert data: ${err.data}`)
    if (err.reason) console.log(`  reason: ${err.reason}`)
    if (err.receipt) {
      console.log(`  receipt.status: ${err.receipt.status}`)
      console.log(`  receipt.hash: ${err.receipt.hash}`)
      console.log(`  receipt.gasUsed: ${err.receipt.gasUsed?.toString()}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

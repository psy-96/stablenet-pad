import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import * as dotenv from 'dotenv'

dotenv.config()

const DEPLOYER_PRIVATE_KEY = (process.env.DEPLOYER_PRIVATE_KEY ?? '').replace(/^0x/, '').trim()

// 컴파일 없이 네트워크/서명자 관리 전용
const config: HardhatUserConfig = {
  solidity: '0.7.6', // 더미 — 직접 컴파일하지 않음 (사전 컴파일 아티팩트 사용)
  networks: {
    stablenet: {
      url: 'https://rpc.stablenet.io',
      chainId: 8283,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
}

export default config

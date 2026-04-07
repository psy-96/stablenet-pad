import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      { version: '0.8.20' },
      { version: '0.8.24' },
    ],
  },
  paths: {
    sources: './contracts/templates', // examples/ 제외 — 데모 파일은 컴파일 대상 아님
  },
  networks: {
    'stablenet-testnet': {
      url: process.env.NEXT_PUBLIC_STABLENET_RPC || 'https://api.test.stablenet.network',
      chainId: 8283,
      accounts: [], // 배포는 브라우저 MetaMask에서 처리 — 서버 측 계정 불필요
    },
  },
}

export default config

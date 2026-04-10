import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import { readFileSync } from 'fs'
// .env.local 수동 파싱 (hardhat ESM 환경에서 dotenv require 불가)
try {
  readFileSync('.env.local', 'utf-8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (m && !process.env[m[1]]) {
      // strip inline comment (# ...) and whitespace
      const val = m[2].replace(/#.*$/, '').trim()
      process.env[m[1]] = val
    }
  })
} catch { /* 파일 없으면 무시 */ }

const rawKey = (process.env.DEPLOYER_PRIVATE_KEY ?? '').replace(/^0x/, '').trim()
const DEPLOYER_PRIVATE_KEY = rawKey
const STABLENET_RPC = process.env.NEXT_PUBLIC_STABLENET_RPC ?? 'https://api.test.stablenet.network'

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      { version: '0.8.20' },
      { version: '0.8.24' },
      { version: "0.6.6" },
      { version: '0.5.16' },
    ],
  },
  paths: {
    sources: './contracts/templates',
  },
  networks: {
    'stablenet-testnet': {
      url: STABLENET_RPC,
      chainId: 8283,
      accounts: [], // 배포는 브라우저 MetaMask에서 처리 — 서버 측 계정 불필요
    },
    stablenet: {
      url: STABLENET_RPC,
      chainId: 8283,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      gas: 6_000_000,
    },
  },
}

export default config

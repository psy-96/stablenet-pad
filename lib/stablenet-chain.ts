// 클라이언트/서버 공용 chain 정의 — 'use client' 없음
import { defineChain } from 'viem'

export const stablenetTestnet = defineChain({
  id: 8283,
  name: 'StableNet Testnet',
  nativeCurrency: { decimals: 18, name: 'WKRC', symbol: 'WKRC' },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_STABLENET_RPC ?? 'https://api.test.stablenet.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'StableNet Explorer',
      url: process.env.NEXT_PUBLIC_EXPLORER_URL ?? 'https://explorer.stablenet.network',
    },
  },
})

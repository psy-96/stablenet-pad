'use client'

import { createConfig, http } from 'wagmi'
import { injected, metaMask } from 'wagmi/connectors'
import { stablenetTestnet } from './stablenet-chain'

export { stablenetTestnet }

export const wagmiConfig = createConfig({
  chains: [stablenetTestnet],
  connectors: [injected(), metaMask()],
  transports: { [stablenetTestnet.id]: http() },
})

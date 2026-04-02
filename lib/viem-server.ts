// 서버 전용 viem publicClient — app/api/ 내부에서만 import할 것
// 브라우저에서 직접 RPC를 호출하면 CORS 차단됨

import { createPublicClient, http } from 'viem'
import { stablenetTestnet } from './stablenet-chain'

export const viemPublicClient = createPublicClient({
  chain: stablenetTestnet,
  transport: http(
    process.env.NEXT_PUBLIC_STABLENET_RPC ?? 'https://api.test.stablenet.network'
  ),
})

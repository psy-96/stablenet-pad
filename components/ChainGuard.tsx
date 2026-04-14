'use client'

import { useEffect } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { STABLENET_CHAIN_ID } from '@/lib/stablenet'

/**
 * 지갑이 연결된 상태에서 chainId가 StableNet(8283)이 아니면
 * 자동으로 switchChain을 호출한다.
 * MetaMask에 StableNet이 등록되어 있지 않으면 addEthereumChain 팝업이 뜬다.
 */
export default function ChainGuard() {
  const { isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  useEffect(() => {
    if (isConnected && chainId !== STABLENET_CHAIN_ID) {
      switchChain({ chainId: STABLENET_CHAIN_ID })
    }
  }, [isConnected, chainId, switchChain])

  return null
}

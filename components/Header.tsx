'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain, useBalance } from 'wagmi'
import { stablenetTestnet } from '@/lib/wagmi'
import { explorerAddressUrl } from '@/lib/stablenet'
import { formatEther } from 'viem'

const METAMASK_INSTALL_URL = 'https://metamask.io/download/'

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export default function Header() {
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { data: balance, isError: balanceError } = useBalance({
    address,
    chainId: stablenetTestnet.id,
  })

  const isCorrectChain = chainId === stablenetTestnet.id
  const isMetaMaskInstalled =
    typeof window !== 'undefined' &&
    Boolean((window as Window & { ethereum?: unknown }).ethereum)

  function handleConnect() {
    // wagmiConfig에 등록된 connector 인스턴스를 사용해야 함 — metaMask()를 새로 호출하면 안 됨
    const connector = connectors[0]
    if (connector) connect({ connector })
  }

  function handleSwitchChain() {
    switchChain({
      chainId: stablenetTestnet.id,
      addEthereumChainParameter: {
        chainName: stablenetTestnet.name,
        nativeCurrency: stablenetTestnet.nativeCurrency,
        rpcUrls: [stablenetTestnet.rpcUrls.default.http[0]],
        blockExplorerUrls: [stablenetTestnet.blockExplorers.default.url],
      },
    })
  }

  return (
    <header className="border-b border-gray-800 bg-gray-950 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-white">stablenet-pad</span>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
          Testnet · Chain ID 8283
        </span>
      </div>

      <div className="flex items-center gap-3">
        {!mounted ? (
          // SSR/hydration 불일치 방지 — 마운트 전엔 빈 placeholder
          <div className="w-32 h-8 rounded-lg bg-gray-800 animate-pulse" />
        ) : !isConnected ? (
          isMetaMaskInstalled ? (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors"
            >
              {isConnecting ? '연결 중...' : 'MetaMask 연결'}
            </button>
          ) : (
            <a
              href={METAMASK_INSTALL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded-lg transition-colors"
            >
              MetaMask 설치하기 ↗
            </a>
          )
        ) : (
          <div className="flex items-center gap-3">
            {!isCorrectChain ? (
              <button
                onClick={handleSwitchChain}
                className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded-lg transition-colors"
              >
                StableNet으로 전환
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                <span className="text-gray-400">
                  {balanceError
                    ? '- WKRC'
                    : balance
                      ? `${Number(formatEther(balance.value)).toFixed(4)} WKRC`
                      : '조회 중...'}
                </span>
              </div>
            )}

            <a
              href={explorerAddressUrl(address!)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg font-mono transition-colors"
            >
              {shortAddress(address!)}
            </a>

            <button
              onClick={() => disconnect()}
              className="px-3 py-1.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              연결 해제
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

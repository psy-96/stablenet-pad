export const STABLENET_CHAIN_ID = 8283
export const STABLENET_RPC_URL = process.env.NEXT_PUBLIC_STABLENET_RPC ?? 'https://api.test.stablenet.network'
export const STABLENET_EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL ?? 'https://explorer.stablenet.network'
export const STABLENET_NETWORK_NAME = 'stablenet-testnet'

export function explorerTxUrl(txHash: string): string {
  return `${STABLENET_EXPLORER_URL}/tx/${txHash}`
}

export function explorerAddressUrl(address: string): string {
  return `${STABLENET_EXPLORER_URL}/address/${address}`
}

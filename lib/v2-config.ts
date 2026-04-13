import type { DeploymentResult } from '@/types'

export const V2_FACTORY_ADDRESS =
  process.env.NEXT_PUBLIC_V2_FACTORY_ADDRESS ?? '0xec1c0fb2ceaa7349b381e5bdd574f6369b4129ce'
export const V2_ROUTER_ADDRESS =
  process.env.NEXT_PUBLIC_V2_ROUTER_ADDRESS ?? '0xe56c3f0375ec5644509715c42aa8764d4c857d01'

export const FACTORY_ABI = [
  { inputs: [{ internalType: 'address', name: '_feeToSetter', type: 'address' }], stateMutability: 'nonpayable', type: 'constructor' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: 'token0', type: 'address' }, { indexed: true, internalType: 'address', name: 'token1', type: 'address' }, { indexed: false, internalType: 'address', name: 'pair', type: 'address' }, { indexed: false, internalType: 'uint256', name: '', type: 'uint256' }], name: 'PairCreated', type: 'event' },
  { inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], name: 'allPairs', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'allPairsLength', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'tokenA', type: 'address' }, { internalType: 'address', name: 'tokenB', type: 'address' }], name: 'createPair', outputs: [{ internalType: 'address', name: 'pair', type: 'address' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'feeTo', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'feeToSetter', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: '', type: 'address' }, { internalType: 'address', name: '', type: 'address' }], name: 'getPair', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: '_feeTo', type: 'address' }], name: 'setFeeTo', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'address', name: '_feeToSetter', type: 'address' }], name: 'setFeeToSetter', outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const

export const ROUTER_ABI = [
  { inputs: [{ internalType: 'address', name: '_factory', type: 'address' }, { internalType: 'address', name: '_WKRC', type: 'address' }], stateMutability: 'nonpayable', type: 'constructor' },
  { inputs: [], name: 'WKRC', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'tokenA', type: 'address' }, { internalType: 'address', name: 'tokenB', type: 'address' }, { internalType: 'uint256', name: 'amountADesired', type: 'uint256' }, { internalType: 'uint256', name: 'amountBDesired', type: 'uint256' }, { internalType: 'uint256', name: 'amountAMin', type: 'uint256' }, { internalType: 'uint256', name: 'amountBMin', type: 'uint256' }, { internalType: 'address', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'deadline', type: 'uint256' }], name: 'addLiquidity', outputs: [{ internalType: 'uint256', name: 'amountA', type: 'uint256' }, { internalType: 'uint256', name: 'amountB', type: 'uint256' }, { internalType: 'uint256', name: 'liquidity', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'token', type: 'address' }, { internalType: 'uint256', name: 'amountTokenDesired', type: 'uint256' }, { internalType: 'uint256', name: 'amountTokenMin', type: 'uint256' }, { internalType: 'uint256', name: 'amountETHMin', type: 'uint256' }, { internalType: 'address', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'deadline', type: 'uint256' }], name: 'addLiquidityETH', outputs: [{ internalType: 'uint256', name: 'amountToken', type: 'uint256' }, { internalType: 'uint256', name: 'amountETH', type: 'uint256' }, { internalType: 'uint256', name: 'liquidity', type: 'uint256' }], stateMutability: 'payable', type: 'function' },
  { inputs: [], name: 'factory', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }, { internalType: 'uint256', name: 'reserveIn', type: 'uint256' }, { internalType: 'uint256', name: 'reserveOut', type: 'uint256' }], name: 'getAmountIn', outputs: [{ internalType: 'uint256', name: 'amountIn', type: 'uint256' }], stateMutability: 'pure', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'amountIn', type: 'uint256' }, { internalType: 'uint256', name: 'reserveIn', type: 'uint256' }, { internalType: 'uint256', name: 'reserveOut', type: 'uint256' }], name: 'getAmountOut', outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }], stateMutability: 'pure', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }, { internalType: 'address[]', name: 'path', type: 'address[]' }], name: 'getAmountsIn', outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'amountIn', type: 'uint256' }, { internalType: 'address[]', name: 'path', type: 'address[]' }], name: 'getAmountsOut', outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'amountA', type: 'uint256' }, { internalType: 'uint256', name: 'reserveA', type: 'uint256' }, { internalType: 'uint256', name: 'reserveB', type: 'uint256' }], name: 'quote', outputs: [{ internalType: 'uint256', name: 'amountB', type: 'uint256' }], stateMutability: 'pure', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'tokenA', type: 'address' }, { internalType: 'address', name: 'tokenB', type: 'address' }, { internalType: 'uint256', name: 'liquidity', type: 'uint256' }, { internalType: 'uint256', name: 'amountAMin', type: 'uint256' }, { internalType: 'uint256', name: 'amountBMin', type: 'uint256' }, { internalType: 'address', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'deadline', type: 'uint256' }], name: 'removeLiquidity', outputs: [{ internalType: 'uint256', name: 'amountA', type: 'uint256' }, { internalType: 'uint256', name: 'amountB', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'token', type: 'address' }, { internalType: 'uint256', name: 'liquidity', type: 'uint256' }, { internalType: 'uint256', name: 'amountTokenMin', type: 'uint256' }, { internalType: 'uint256', name: 'amountETHMin', type: 'uint256' }, { internalType: 'address', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'deadline', type: 'uint256' }], name: 'removeLiquidityETH', outputs: [{ internalType: 'uint256', name: 'amountToken', type: 'uint256' }, { internalType: 'uint256', name: 'amountETH', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }, { internalType: 'address[]', name: 'path', type: 'address[]' }, { internalType: 'address', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'deadline', type: 'uint256' }], name: 'swapETHForExactTokens', outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }], stateMutability: 'payable', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'amountOutMin', type: 'uint256' }, { internalType: 'address[]', name: 'path', type: 'address[]' }, { internalType: 'address', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'deadline', type: 'uint256' }], name: 'swapExactETHForTokens', outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }], stateMutability: 'payable', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'amountIn', type: 'uint256' }, { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' }, { internalType: 'address[]', name: 'path', type: 'address[]' }, { internalType: 'address', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'deadline', type: 'uint256' }], name: 'swapExactTokensForETH', outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'amountIn', type: 'uint256' }, { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' }, { internalType: 'address[]', name: 'path', type: 'address[]' }, { internalType: 'address', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'deadline', type: 'uint256' }], name: 'swapExactTokensForTokens', outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }, { internalType: 'uint256', name: 'amountInMax', type: 'uint256' }, { internalType: 'address[]', name: 'path', type: 'address[]' }, { internalType: 'address', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'deadline', type: 'uint256' }], name: 'swapTokensForExactETH', outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }, { internalType: 'uint256', name: 'amountInMax', type: 'uint256' }, { internalType: 'address[]', name: 'path', type: 'address[]' }, { internalType: 'address', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'deadline', type: 'uint256' }], name: 'swapTokensForExactTokens', outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }], stateMutability: 'nonpayable', type: 'function' },
  { stateMutability: 'payable', type: 'receive' },
] as const

export const FACTORY_DEPLOYMENT: DeploymentResult = {
  id: 'v2-factory',
  contractName: 'UniswapV2Factory',
  type: 'UniswapV2Factory',
  proxyAddress: null,
  implementationAddress: V2_FACTORY_ADDRESS,
  previousProxyAddress: null,
  txHash: null,
  blockNumber: null,
  deployer: null,
  network: 'stablenet-testnet',
  chainId: 8283,
  status: 'success',
  abi: FACTORY_ABI as unknown as object[],
  createdAt: '',
  pinned: false,
  source: 'imported',
}

export const ROUTER_DEPLOYMENT: DeploymentResult = {
  id: 'v2-router',
  contractName: 'UniswapV2Router02',
  type: 'UniswapV2Router02',
  proxyAddress: null,
  implementationAddress: V2_ROUTER_ADDRESS,
  previousProxyAddress: null,
  txHash: null,
  blockNumber: null,
  deployer: null,
  network: 'stablenet-testnet',
  chainId: 8283,
  status: 'success',
  abi: ROUTER_ABI as unknown as object[],
  createdAt: '',
  pinned: false,
  source: 'imported',
}

export type ContractType = 'ERC20' | 'LiquidityPool'

export type SSEEventType = 'compiling' | 'compiled' | 'error' | 'saving' | 'done'

export interface SSEEvent {
  event: SSEEventType
  data: {
    message: string
    githubCommitUrl?: string | null
  }
}

export interface ERC20Params {
  name: string
  symbol: string
  initialSupply: string // 폼에서는 string, BigInt 변환은 배포 직전에 수행
}

export interface LiquidityPoolParams {
  tokenA: string  // proxy_address
  tokenB: string  // proxy_address
  fee: string     // uint24, BigInt 변환은 배포 직전에 수행
}

export type ContractParams = ERC20Params | LiquidityPoolParams

export interface DeploymentResult {
  id: string
  contractName: string
  type: ContractType
  proxyAddress: string | null
  implementationAddress: string | null
  previousProxyAddress: string | null
  txHash: string | null
  blockNumber: number | null
  deployer: string | null
  network: string
  chainId: number
  status: 'success' | 'failed'
  abi: object[] | null
  createdAt: string
}

export interface DeploymentArtifact {
  contractName: string
  type: ContractType
  network: string
  chainId: number
  proxyAddress: string | null
  implementationAddress: string | null
  previousProxyAddress: string | null
  abi: object[]
  txHash: string | null
  blockNumber: number | null
  deployedAt: string
  deployer: string | null
}

// POST /api/upload 응답
export interface UploadResponse {
  tempPath: string
  deploymentId: string
}

// POST /api/deploy 요청
export interface DeployRequest {
  contractType: ContractType
  fileName: string
  tempPath: string
  deploymentId: string
  params: ContractParams
  useProxy: boolean
  deployerAddress: string
}

// POST /api/deploy 응답
export interface DeployResponse {
  deploymentId: string
  status: 'compiled'
  bytecode: string
  abi: object[]
}

// POST /api/deploy/confirm 요청
// txHash만 넘기면 서버가 waitForTransactionReceipt로 proxyAddress/blockNumber를 직접 추출
export interface ConfirmRequest {
  deploymentId: string
  contractName: string
  contractType: ContractType
  txHash: string            // 최종 tx (proxy 배포 또는 단순 배포)
  implTxHash?: string | null  // Proxy 배포 시: Implementation tx hash
  implAddress?: string | null  // Proxy 배포 시: Implementation 컨트랙트 주소
  deployerAddress: string
  abi: object[]
}

// POST /api/deploy/confirm 응답
export interface ConfirmResponse {
  success: boolean
  githubCommitUrl: string | null
  proxyAddress: string
  blockNumber: number
}

// Phase 1-A: ContractType을 string으로 완화 (registry id 또는 컨트랙트 파일명)
export type ContractType = string

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

// Phase 1-A: registry 기반 범용 파라미터 맵
export type ContractParams = Record<string, string>

export interface DeploymentResult {
  id: string
  contractName: string
  type: string
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
  type: string
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
  contractType: string
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
export interface ConfirmRequest {
  deploymentId: string
  contractName: string
  contractType: string
  txHash: string
  implTxHash?: string | null
  implAddress?: string | null
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

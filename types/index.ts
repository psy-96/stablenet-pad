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
  pinned: boolean
  source: 'deployed' | 'imported'
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
  proxyAddress: string | null
  implementationAddress: string | null
  blockNumber: number
}

// ─── Phase 2: 운영 액션 ───────────────────────────────────────────────────

/**
 * ABI write 함수 파라미터 타입 분류
 * - text    : string → text input
 * - address : address → text input (0x 검증)
 * - uint256 : uint*, int* → number input (BigInt 변환)
 * - bool    : bool → checkbox
 * - raw-hex : bytes, bytes32 등 → hex text input
 * - array   : address[], uint256[] 등 단일 타입 배열 → 동적 항목 추가 UI
 * - disabled: tuple, tuple[], 기타 복합 타입 → UI 비활성
 */
export type ActionParamType = 'text' | 'address' | 'uint256' | 'bool' | 'raw-hex' | 'array' | 'tuple' | 'disabled'

export interface ActionParam {
  /** index 기반 고유 키 — state key / React key 용도 (e.g. 'param_0') */
  key: string
  /** 원본 ABI 파라미터 이름 — PARAM_DEFAULTS 매칭 등 이름 기반 로직 용도 */
  name: string
  label: string
  /** 원본 Solidity 타입 — 인코딩 시 사용 */
  solType: string
  type: ActionParamType
  /** array 타입일 때 항목의 Solidity 타입 (e.g. 'address', 'uint256') */
  arrayItemSolType?: string
  /** tuple 타입일 때 내부 컴포넌트 필드 */
  components?: ActionParam[]
}

export interface ActionFunctionDef {
  name: string
  /** e.g. "mint(address,uint256)" */
  signature: string
  params: ActionParam[]
  stateMutability: 'nonpayable' | 'payable'
}

// POST /api/actions/confirm 요청
export interface ActionConfirmRequest {
  /** deployments 테이블 UUID */
  deploymentRowId: string
  functionName: string
  /** 실행한 파라미터 (표시용, jsonb) */
  params: Record<string, string>
  txHash: string
  blockNumber: number
  executor: string
}

// 트랜잭션 receipt에서 파싱한 이벤트 (표시용)
export interface ParsedEvent {
  name: string
  /** 모든 값을 string으로 직렬화한 args (BigInt 포함) */
  args: Record<string, string>
}

// POST /api/actions/confirm 응답
export interface ActionConfirmResponse {
  success: boolean
  actionId: string
  events?: ParsedEvent[]
}

// ─── Phase 2 (ISSUE-5): Read 함수 ────────────────────────────────────────────

export interface ReadFunctionDef {
  name: string
  /** e.g. "balanceOf(address)" */
  signature: string
  params: ActionParam[]
  stateMutability: 'view' | 'pure'
  outputs: { name: string; type: string }[]
}

// POST /api/contracts/read 요청
export interface ContractReadRequest {
  address: string
  abi: object[]
  functionName: string
  /** 파라미터 값 — 순서대로, string 직렬화 */
  args: string[]
}

// POST /api/contracts/read 응답
export interface ContractReadResponse {
  /** BigInt → string, 나머지는 JSON 직렬화 */
  result: string
}

// ─── ISSUE-1: 액션 이력 ──────────────────────────────────────────────────────

export interface ActionHistoryItem {
  id: string
  functionName: string
  params: Record<string, string> | null
  txHash: string | null
  blockNumber: number | null
  executor: string | null
  status: 'success' | 'failed'
  events: ParsedEvent[] | null
  createdAt: string
}

// GET /api/actions 응답
export interface ActionHistoryResponse {
  actions: ActionHistoryItem[]
}

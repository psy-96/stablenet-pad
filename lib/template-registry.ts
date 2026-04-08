export interface TemplateParam {
  key: string
  label: string
  type: 'text' | 'address' | 'uint256' | 'address-select'
  /** address-select 타입일 때 옵션을 fetch할 URL (컴포넌트에서 실행) */
  fetchUrl?: string
  /** input placeholder 텍스트 */
  placeholder?: string
  /** 필드 하단 설명 힌트 */
  hint?: string
}

export interface TemplateDefinition {
  /** registry 식별자 — Supabase type 컬럼 및 API contractType으로 사용 */
  id: string
  /** UI 표시명 */
  label: string
  /** contracts/templates/ 기준 상대 경로 */
  solFile: string
  params: TemplateParam[]
  /** Proxy (ERC1967) 패턴 사용 여부 — 기본 true */
  useProxy: boolean
}

export const TEMPLATE_REGISTRY: TemplateDefinition[] = [
  {
    id: 'ERC20',
    label: 'ERC20 Token',
    solFile: 'contracts/templates/ERC20Token.sol',
    useProxy: true,
    params: [
      { key: 'name', label: '토큰 이름', type: 'text' },
      { key: 'symbol', label: '심볼', type: 'text' },
      { key: 'initialSupply', label: '초기 발행량 (최소 단위)', type: 'uint256' },
    ],
  },
  {
    id: 'LiquidityPool',
    label: 'Liquidity Pool',
    solFile: 'contracts/templates/LiquidityPool.sol',
    useProxy: true,
    params: [
      {
        key: '_tokenA',
        label: 'Token A',
        type: 'address-select',
        fetchUrl: '/api/deployments?type=ERC20',
      },
      {
        key: '_tokenB',
        label: 'Token B',
        type: 'address-select',
        fetchUrl: '/api/deployments?type=ERC20',
      },
      {
        key: '_fee',
        label: '수수료 (uint24)',
        type: 'uint256',
        placeholder: '예: 3000',
        hint: 'Uniswap V3 기준: 500 (0.05%) · 3000 (0.3%) · 10000 (1%)',
      },
    ],
  },
  {
    id: 'SimpleVault',
    label: 'Simple Vault',
    solFile: 'contracts/templates/SimpleVault.sol',
    useProxy: true,
    params: [
      { key: 'owner_', label: '오너 주소', type: 'address' },
    ],
  },
]

export function getTemplateById(id: string): TemplateDefinition | undefined {
  return TEMPLATE_REGISTRY.find((t) => t.id === id)
}

// ABI 지원 타입 → TemplateParam type 매핑
const ABI_TYPE_MAP: Record<string, TemplateParam['type']> = {
  string: 'text',
  address: 'address',
  uint256: 'uint256',
  uint24: 'uint256',
  uint8: 'uint256',
}

/**
 * 컴파일된 ABI의 initialize() inputs를 ContractParamsForm이 렌더링할 수 있는
 * TemplateParam[] 으로 변환한다.
 *
 * - initialize() 없으면: 빈 배열 반환 (Proxy는 0x initData로 배포 가능)
 * - 지원 외 타입(bytes32, bool, tuple 등) 포함 시: error 반환 → 배포 불가
 */
export function abiInputsToTemplateParams(
  abi: { type: string; name: string; inputs?: { name: string; type: string }[] }[]
): { params: TemplateParam[] } | { error: string } {
  const initFn = abi.find((item) => item.type === 'function' && item.name === 'initialize')

  if (!initFn || !initFn.inputs || initFn.inputs.length === 0) {
    return { params: [] }
  }

  const params: TemplateParam[] = []
  for (const input of initFn.inputs) {
    const mappedType = ABI_TYPE_MAP[input.type]
    if (!mappedType) {
      return {
        error: `지원하지 않는 파라미터 타입 포함: ${input.type} (지원: string, address, uint256, uint24, uint8)`,
      }
    }
    params.push({
      key: input.name,
      label: input.name,
      type: mappedType,
    })
  }

  return { params }
}

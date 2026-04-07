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

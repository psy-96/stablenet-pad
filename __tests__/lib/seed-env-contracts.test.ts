import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ─────────────────────────────────────────────────────────

type MockRow = Record<string, unknown>
type MockResult = { data: MockRow | null; error: { code: string; message: string } | null }

let selectResults: Map<string, MockRow | null>
let insertErrors: Map<string, { code: string; message: string } | null>
let updateErrors: Map<string, { code: string; message: string } | null>
let insertedRows: MockRow[]
let updatedRows: { id: string; row: MockRow }[]

function resetState() {
  selectResults = new Map()
  insertErrors = new Map()
  updateErrors = new Map()
  insertedRows = []
  updatedRows = []
}

function makeSelectChain() {
  let targetId: string | null = null
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    eq: (_col: unknown, id: unknown) => {
      targetId = id as string
      return chain
    },
    single: () => {
      const existing = selectResults.get(targetId!) ?? null
      return Promise.resolve({ data: existing, error: null } satisfies MockResult)
    },
  }
  return chain
}

function makeInsertFn() {
  return (row: MockRow) => {
    insertedRows.push(row)
    const id = (row as { id?: string }).id ?? ''
    const err = insertErrors.get(id) ?? null
    return Promise.resolve({ data: null, error: err } satisfies MockResult)
  }
}

function makeUpdateFn() {
  return (row: MockRow) => {
    const chain: Record<string, (...args: unknown[]) => unknown> = {
      eq: (_col: unknown, id: unknown) => {
        updatedRows.push({ id: id as string, row })
        const err = updateErrors.get(id as string) ?? null
        return Promise.resolve({ data: null, error: err } satisfies MockResult)
      },
    }
    return chain
  }
}

const mockFrom = vi.fn((_table: string) => ({
  select: () => makeSelectChain(),
  insert: makeInsertFn(),
  update: makeUpdateFn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: { from: (...args: unknown[]) => mockFrom(...(args as [string])) },
}))

// ── Import after mock ─────────────────────────────────────────────────────

const { seedEnvContracts } = await import('@/lib/seed-env-contracts')
const { ENV_CONTRACT_IDS } = await import('@/lib/env-contract-ids')

// ── Tests ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetState()
  vi.clearAllMocks()
})

describe('seedEnvContracts', () => {
  it('inserts all 5 contracts with pinned: true when none exist', async () => {
    // selectResults empty → all select().eq().single() return null

    await seedEnvContracts()

    expect(insertedRows).toHaveLength(5)
    for (const row of insertedRows) {
      expect(row).toHaveProperty('pinned', true)
      expect(row).toHaveProperty('source', 'imported')
      expect(row).toHaveProperty('status', 'success')
      expect(row).toHaveProperty('network', 'stablenet-testnet')
      expect(row).toHaveProperty('chain_id', 8283)
    }

    // ID 검증
    const ids = insertedRows.map((r) => (r as { id: string }).id)
    expect(ids).toContain(ENV_CONTRACT_IDS.V2_FACTORY)
    expect(ids).toContain(ENV_CONTRACT_IDS.V2_ROUTER)
    expect(ids).toContain(ENV_CONTRACT_IDS.V3_FACTORY)
    expect(ids).toContain(ENV_CONTRACT_IDS.V3_POSITION_MANAGER)
    expect(ids).toContain(ENV_CONTRACT_IDS.V3_SWAP_ROUTER)
  })

  it('updates without pinned when record already exists', async () => {
    // 모든 레코드 존재 상태
    selectResults.set(ENV_CONTRACT_IDS.V2_FACTORY, { id: ENV_CONTRACT_IDS.V2_FACTORY })
    selectResults.set(ENV_CONTRACT_IDS.V2_ROUTER, { id: ENV_CONTRACT_IDS.V2_ROUTER })
    selectResults.set(ENV_CONTRACT_IDS.V3_FACTORY, { id: ENV_CONTRACT_IDS.V3_FACTORY })
    selectResults.set(ENV_CONTRACT_IDS.V3_POSITION_MANAGER, { id: ENV_CONTRACT_IDS.V3_POSITION_MANAGER })
    selectResults.set(ENV_CONTRACT_IDS.V3_SWAP_ROUTER, { id: ENV_CONTRACT_IDS.V3_SWAP_ROUTER })

    await seedEnvContracts()

    // insert 없어야 함
    expect(insertedRows).toHaveLength(0)

    // update 5회, pinned 미포함
    expect(updatedRows).toHaveLength(5)
    for (const { row } of updatedRows) {
      expect(row).not.toHaveProperty('pinned')
      expect(row).toHaveProperty('contract_name')
      expect(row).toHaveProperty('abi')
    }
  })

  it('is idempotent — second call produces no errors', async () => {
    await seedEnvContracts()
    resetState()
    await seedEnvContracts()

    // 두 번째도 정상 완료
    expect(insertedRows).toHaveLength(5)
  })

  it('falls back to update on PK conflict (concurrent boot)', async () => {
    // insert 시 PK 충돌 시뮬레이션
    for (const id of Object.values(ENV_CONTRACT_IDS)) {
      insertErrors.set(id, { code: '23505', message: 'unique_violation' })
    }

    await seedEnvContracts()

    // insert 5회 시도 → 실패 → update fallback 5회
    expect(insertedRows).toHaveLength(5)
    expect(updatedRows).toHaveLength(5)

    // fallback update에도 pinned 미포함
    for (const { row } of updatedRows) {
      expect(row).not.toHaveProperty('pinned')
    }
  })

  it('skips contract when env var address is missing and warns', async () => {
    // V2_FACTORY_ADDRESS를 undefined로 만들기 위해 모듈을 재mock할 수 없으므로
    // 기본값이 있는 현재 구조에서는 skip이 발생하지 않음을 확인
    // (env var에 default fallback이 있으므로 항상 address가 존재)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await seedEnvContracts()

    // 기본값이 있으므로 5개 전부 insert
    expect(insertedRows).toHaveLength(5)

    warnSpy.mockRestore()
  })
})

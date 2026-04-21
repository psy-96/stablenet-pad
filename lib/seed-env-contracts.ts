import { supabaseServer } from '@/lib/supabase/server'
import {
  V2_FACTORY_ADDRESS,
  V2_ROUTER_ADDRESS,
  FACTORY_ABI,
  ROUTER_ABI,
} from '@/lib/v2-config'
import {
  V3_FACTORY_ADDRESS,
  V3_POSITION_MANAGER_ADDRESS,
  V3_SWAP_ROUTER_ADDRESS,
  V3_FACTORY_ABI,
  V3_POSITION_MANAGER_ABI,
  V3_SWAP_ROUTER_ABI,
} from '@/lib/v3-config'
import { ENV_CONTRACT_IDS } from '@/lib/env-contract-ids'

export { ENV_CONTRACT_IDS } from '@/lib/env-contract-ids'

interface EnvContractDef {
  id: string
  contractName: string
  type: string
  address: string | undefined
  abi: readonly object[]
  envVarName: string
}

const ENV_CONTRACTS: EnvContractDef[] = [
  {
    id: ENV_CONTRACT_IDS.V2_FACTORY,
    contractName: 'UniswapV2Factory',
    type: 'UniswapV2Factory',
    address: V2_FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    envVarName: 'NEXT_PUBLIC_V2_FACTORY_ADDRESS',
  },
  {
    id: ENV_CONTRACT_IDS.V2_ROUTER,
    contractName: 'UniswapV2Router02',
    type: 'UniswapV2Router02',
    address: V2_ROUTER_ADDRESS,
    abi: ROUTER_ABI,
    envVarName: 'NEXT_PUBLIC_V2_ROUTER_ADDRESS',
  },
  {
    id: ENV_CONTRACT_IDS.V3_FACTORY,
    contractName: 'UniswapV3Factory',
    type: 'UniswapV3Factory',
    address: V3_FACTORY_ADDRESS,
    abi: V3_FACTORY_ABI,
    envVarName: 'NEXT_PUBLIC_V3_FACTORY_ADDRESS',
  },
  {
    id: ENV_CONTRACT_IDS.V3_POSITION_MANAGER,
    contractName: 'NonfungiblePositionManager',
    type: 'NonfungiblePositionManager',
    address: V3_POSITION_MANAGER_ADDRESS,
    abi: V3_POSITION_MANAGER_ABI,
    envVarName: 'NEXT_PUBLIC_V3_POSITION_MANAGER_ADDRESS',
  },
  {
    id: ENV_CONTRACT_IDS.V3_SWAP_ROUTER,
    contractName: 'SwapRouter',
    type: 'SwapRouter',
    address: V3_SWAP_ROUTER_ADDRESS,
    abi: V3_SWAP_ROUTER_ABI,
    envVarName: 'NEXT_PUBLIC_V3_ROUTER_ADDRESS',
  },
]

/**
 * Env 컨트랙트 5개를 deployments 테이블에 seed.
 * - 존재하지 않으면 insert (pinned: true)
 * - 존재하면 update (pinned 제외, 메타만 덮어씀)
 * - insert PK 충돌 시 update fallback (동시 부팅 대응)
 */
export async function seedEnvContracts(): Promise<void> {
  for (const def of ENV_CONTRACTS) {
    if (!def.address) {
      console.warn(`[seed-env] ${def.envVarName} 누락 — ${def.contractName} skip`)
      continue
    }

    const row = {
      contract_name: def.contractName,
      type: def.type,
      proxy_address: null,
      implementation_address: def.address,
      previous_proxy_address: null,
      tx_hash: null,
      block_number: null,
      deployer: null,
      network: 'stablenet-testnet',
      chain_id: 8283,
      status: 'success' as const,
      abi: def.abi as unknown as object[],
      source: 'imported' as const,
    }

    // 기존 레코드 확인
    const { data: existing } = await supabaseServer
      .from('deployments')
      .select('id')
      .eq('id', def.id)
      .single()

    if (existing) {
      // 존재 → pinned 제외하고 메타만 update
      const { error } = await supabaseServer
        .from('deployments')
        .update(row)
        .eq('id', def.id)

      if (error) {
        console.warn(`[seed-env] ${def.contractName} update 실패:`, error.message)
      }
    } else {
      // 미존재 → insert (pinned: true 포함)
      const { error } = await supabaseServer
        .from('deployments')
        .insert({ id: def.id, ...row, pinned: true })

      if (error) {
        // PK 충돌 (동시 부팅) → update fallback
        if (error.code === '23505') {
          const { error: updateError } = await supabaseServer
            .from('deployments')
            .update(row)
            .eq('id', def.id)

          if (updateError) {
            console.warn(`[seed-env] ${def.contractName} fallback update 실패:`, updateError.message)
          }
        } else {
          console.warn(`[seed-env] ${def.contractName} insert 실패:`, error.message)
        }
      }
    }
  }
}

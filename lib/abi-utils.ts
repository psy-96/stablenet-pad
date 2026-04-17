import { classifyAbiType } from './template-registry'
import type { ActionParam, ReadFunctionDef } from '@/types'

type AbiInputField = {
  name: string
  type: string
  components?: AbiInputField[]
}

type AbiItem = {
  type: string
  name?: string
  stateMutability?: string
  inputs?: AbiInputField[]
  outputs?: { name: string; type: string }[]
}

function arrayItemType(solType: string): string {
  return solType.replace(/\[\d*\]$/, '')
}

function inputToActionParam(input: AbiInputField, idx: number): ActionParam {
  const paramType = classifyAbiType(input.type)
  return {
    key: `param_${idx}`,
    name: input.name || '',
    label: input.name || `[${idx}]`,
    solType: input.type,
    type: paramType,
    ...(paramType === 'array' ? { arrayItemSolType: arrayItemType(input.type) } : {}),
    ...(paramType === 'tuple' && input.components
      ? { components: input.components.map((c, ci) => inputToActionParam(c, ci)) }
      : {}),
  }
}

/**
 * ABI에서 view/pure 함수 목록을 추출해 ReadFunctionDef[] 로 반환한다.
 */
export function abiReadFunctionsToActions(abi: AbiItem[]): ReadFunctionDef[] {
  const result: ReadFunctionDef[] = []

  for (const item of abi) {
    if (item.type !== 'function') continue
    if (!item.name) continue
    const mut = item.stateMutability
    if (mut !== 'view' && mut !== 'pure') continue

    const params: ActionParam[] = (item.inputs ?? []).map((inp, idx) => inputToActionParam(inp, idx))

    const paramSig = (item.inputs ?? []).map((i) => i.type).join(',')
    result.push({
      name: item.name,
      signature: `${item.name}(${paramSig})`,
      params,
      stateMutability: mut as 'view' | 'pure',
      outputs: item.outputs ?? [],
    })
  }

  return result
}

import { NextResponse } from 'next/server'
import type { Abi, AbiFunction } from 'viem'
import { viemPublicClient } from '@/lib/viem-server'
import type { ContractReadRequest, ContractReadResponse } from '@/types'

/** Solidity 타입에 따라 string 값을 viem 호출용 타입으로 변환 */
function coerceArg(value: string, solType: string): unknown {
  if (/^u?int(\d+)?$/.test(solType)) return BigInt(value)
  if (solType === 'bool') return value === 'true'
  // address, string, bytes* → string 그대로
  return value
}

/** viem 결과를 직렬화 */
function serializeResult(value: unknown): string {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) {
    return JSON.stringify(value.map(serializeResult))
  }
  if (value === null || value === undefined) return ''
  return String(value)
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: ContractReadRequest
  try {
    body = (await req.json()) as ContractReadRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { address, abi, functionName, args } = body

  if (!address || !abi || !functionName) {
    return NextResponse.json({ error: 'address, abi, functionName required' }, { status: 400 })
  }

  // ABI에서 해당 함수의 input 타입 찾기 (args 타입 변환용)
  const fnItem = (abi as Abi).find(
    (item): item is AbiFunction =>
      item.type === 'function' && item.name === functionName
  )
  const inputTypes = fnItem?.inputs?.map((i) => i.type) ?? []
  const coercedArgs = (args ?? []).map((v, i) =>
    coerceArg(v, inputTypes[i] ?? 'string')
  )

  try {
    const result = await viemPublicClient.readContract({
      address: address as `0x${string}`,
      abi: abi as Abi,
      functionName,
      args: coercedArgs,
    })

    const response: ContractReadResponse = { result: serializeResult(result) }
    return NextResponse.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

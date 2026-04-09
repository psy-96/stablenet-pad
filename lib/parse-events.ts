/**
 * 서버 전용 — app/api/ 내부에서만 import할 것.
 * receipt.logs를 ABI로 디코딩해 ParsedEvent[] 반환.
 */
import { decodeEventLog, type Abi, type Log } from 'viem'
import type { ParsedEvent } from '@/types'

/** BigInt 포함 args를 string으로 직렬화 */
export function serializeEventArgs(
  args: Record<string, unknown> | readonly unknown[] | undefined
): Record<string, string> {
  if (!args) return {}
  if (Array.isArray(args)) {
    return Object.fromEntries((args as unknown[]).map((v, i) => [String(i), String(v)]))
  }
  return Object.fromEntries(
    Object.entries(args as Record<string, unknown>).map(([k, v]) => [k, String(v)])
  )
}

/** receipt.logs → ParsedEvent[]. ABI와 일치하지 않는 로그는 무시. */
export function parseReceiptEvents(logs: Log[], abi: Abi): ParsedEvent[] {
  console.log('[parseReceiptEvents] logs.length:', logs.length)
  console.log('[parseReceiptEvents] abi event count:', abi.filter((item) => (item as { type: string }).type === 'event').length)

  return logs.flatMap((log, i) => {
    try {
      const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics })
      console.log(`[parseReceiptEvents] log[${i}] decoded:`, decoded.eventName)
      if (!decoded.eventName) return []
      return [
        {
          name: decoded.eventName,
          args: serializeEventArgs(decoded.args as unknown as Record<string, unknown> | readonly unknown[] | undefined),
        },
      ]
    } catch (err) {
      console.log(`[parseReceiptEvents] log[${i}] topic0=${log.topics[0]} error:`, err instanceof Error ? err.message : String(err))
      return []
    }
  })
}

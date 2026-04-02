import { EventEmitter } from 'events'

// 싱글턴 EventEmitter — 모든 API 라우트가 공유 (단일 Next.js 프로세스 전제)
// deploymentId별로 이벤트를 구분하여 emit/subscribe
export const sseEmitter = new EventEmitter()
sseEmitter.setMaxListeners(50)

export interface EmitPayload {
  event: string
  data: Record<string, unknown>
}

export function emitSSE(deploymentId: string, payload: EmitPayload) {
  sseEmitter.emit(deploymentId, payload)
}

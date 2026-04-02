export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { sseEmitter, type EmitPayload } from '@/lib/sse-emitter'

export async function GET(req: NextRequest) {
  const deploymentIdRaw = req.nextUrl.searchParams.get('deploymentId')

  if (!deploymentIdRaw) {
    return new Response('deploymentId가 필요합니다', { status: 400 })
  }

  // 클로저 안에서 null narrowing 보장
  const deploymentId: string = deploymentIdRaw
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      function sendEvent(payload: EmitPayload) {
        const text = `event: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`
        controller.enqueue(encoder.encode(text))

        // done 또는 error 이벤트 수신 시 스트림 종료
        if (payload.event === 'done' || payload.event === 'error') {
          sseEmitter.off(deploymentId, sendEvent)
          controller.close()
        }
      }

      sseEmitter.on(deploymentId, sendEvent)

      // 클라이언트 연결 해제 시 리스너 정리
      req.signal.addEventListener('abort', () => {
        sseEmitter.off(deploymentId, sendEvent)
        controller.close()
      })

      // 60초 타임아웃
      const timeout = setTimeout(() => {
        sendEvent({
          event: 'error',
          data: { message: '60초 동안 응답이 없어 타임아웃되었습니다' },
        })
      }, 60_000)

      // done/error 도착 시 타임아웃도 정리
      sseEmitter.once(`${deploymentId}:done`, () => clearTimeout(timeout))
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

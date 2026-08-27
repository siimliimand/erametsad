import { verifyAccessToken } from '@/lib/auth/jwt'
import { getUserEventStream } from '@/lib/realtime/my-stream'

export const runtime = 'edge'

export function GET(request: Request) {
  const cookies = request.headers.get('cookie') ?? ''
  const match = /(?:^|;\s*)access_token=([^;]+)/.exec(cookies)
  const token = match?.[1]

  if (!token) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = verifyAccessToken(token)
  if (!payload) {
    return new Response('Unauthorized', { status: 401 })
  }

  const stream = getUserEventStream(payload.userId)

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
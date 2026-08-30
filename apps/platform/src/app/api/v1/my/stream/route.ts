import { verifyAccessToken } from '@/lib/auth/jwt'
import { createMyStream } from '@/lib/realtime/my-stream'

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const

export async function GET(request: Request) {
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

  try {
    const stream = await createMyStream(payload.userId, {
      origin: new URL(request.url).origin,
    })
    return new Response(stream, { headers: SSE_HEADERS })
  } catch {
    return new Response('Stream unavailable', { status: 502 })
  }
}

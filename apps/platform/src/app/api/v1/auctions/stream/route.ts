import { getEventStream } from '@/lib/realtime/auction-stream'

export function GET() {
  const stream = getEventStream()

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
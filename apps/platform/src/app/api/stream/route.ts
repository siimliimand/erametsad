export const runtime = 'edge'

export function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"event":"connected"}\n\n'))
      controller.enqueue(encoder.encode('data: {"event":"heartbeat"}\n\n'))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
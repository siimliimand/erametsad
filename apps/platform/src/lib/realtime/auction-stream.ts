import crypto from 'node:crypto'

interface SSEClient {
  clientId: string
  controller: ReadableStreamDefaultController<Uint8Array>
}

const clients = new Map<string, SSEClient>()
const encoder = new TextEncoder()

function formatSSE(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export function addClient(
  controller: ReadableStreamDefaultController<Uint8Array>,
): { clientId: string; controller: ReadableStreamDefaultController<Uint8Array> } {
  const clientId = crypto.randomUUID()
  const client: SSEClient = { clientId, controller }
  clients.set(clientId, client)
  return { clientId, controller }
}

export function removeClient(clientId: string): void {
  clients.delete(clientId)
}

export function broadcast(event: string, data: unknown): void {
  const message = formatSSE(event, data)
  for (const [clientId, client] of clients) {
    try {
      client.controller.enqueue(message)
    } catch {
      clients.delete(clientId)
    }
  }
}

export function getEventStream(): ReadableStream<Uint8Array> {
  let clientId = ''
  let heartbeat: ReturnType<typeof setInterval> | undefined

  return new ReadableStream({
    start(controller) {
      const client = addClient(controller)
      clientId = client.clientId

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          if (heartbeat !== undefined) clearInterval(heartbeat)
          removeClient(clientId)
        }
      }, 30000)
    },
    cancel() {
      if (heartbeat !== undefined) clearInterval(heartbeat)
      removeClient(clientId)
    },
  })
}
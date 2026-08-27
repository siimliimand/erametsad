import crypto from 'node:crypto'

interface UserClient {
  clientId: string
  controller: ReadableStreamDefaultController<Uint8Array>
}

const users = new Map<string, Map<string, UserClient>>()
const encoder = new TextEncoder()

function formatSSE(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export function addUserClient(
  userId: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
): { clientId: string; controller: ReadableStreamDefaultController<Uint8Array> } {
  let userClients = users.get(userId)
  if (!userClients) {
    userClients = new Map()
    users.set(userId, userClients)
  }

  const clientId = crypto.randomUUID()
  const client: UserClient = { clientId, controller }
  userClients.set(clientId, client)
  return { clientId, controller }
}

export function removeUserClient(userId: string, clientId: string): void {
  const userClients = users.get(userId)
  if (!userClients) return

  userClients.delete(clientId)
  if (userClients.size === 0) {
    users.delete(userId)
  }
}

export function sendToUser(userId: string, event: string, data: unknown): void {
  const userClients = users.get(userId)
  if (!userClients) return

  const message = formatSSE(event, data)
  for (const [clientId, client] of userClients) {
    try {
      client.controller.enqueue(message)
    } catch {
      userClients.delete(clientId)
    }
  }

  if (userClients.size === 0) {
    users.delete(userId)
  }
}

export function getUserEventStream(userId: string): ReadableStream<Uint8Array> {
  let clientId = ''
  let heartbeat: ReturnType<typeof setInterval> | undefined

  return new ReadableStream({
    start(controller) {
      const client = addUserClient(userId, controller)
      clientId = client.clientId

      const connected = formatSSE('connected', { status: 'ok' })
      try {
        controller.enqueue(connected)
      } catch {
        removeUserClient(userId, clientId)
        return
      }

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          if (heartbeat !== undefined) clearInterval(heartbeat)
          removeUserClient(userId, clientId)
        }
      }, 30000)
    },
    cancel() {
      if (heartbeat !== undefined) clearInterval(heartbeat)
      removeUserClient(userId, clientId)
    },
  })
}
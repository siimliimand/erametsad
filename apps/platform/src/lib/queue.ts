export interface Job {
  id: string
  type: string
  payload: Record<string, unknown>
  timestamp: number
}

export type JobHandler = (job: Job) => Promise<void>

export interface Queue {
  enqueue(job: Job): Promise<void>
  process(handler: JobHandler): void
}

function detectEnv(): "cf" | "local" {
  const proc = (globalThis as Record<string, unknown>).process
  return typeof proc !== "undefined" &&
    typeof proc === "object" &&
    proc !== null &&
    typeof (proc as Record<string, unknown>).env === "object" &&
    (proc as Record<string, unknown>).env !== null &&
    typeof (proc as Record<string, unknown>).env === "object"
    ? "cf"
    : "local"
}

export function createQueue(name: string): Queue {
  const env = detectEnv()

  if (env === "cf") {
    return new CloudflareQueue(name)
  }

  return new LocalQueue(name)
}

class CloudflareQueue implements Queue {
  constructor(private readonly name: string) {}

  async enqueue(job: Job): Promise<void> {
    const binding = (globalThis as Record<string, unknown>).env as Record<string, unknown> | undefined
    const queue = binding?.[this.name] as { send: (msg: unknown) => Promise<void> } | undefined

    if (!queue || typeof queue.send !== "function") {
      throw new Error(`Cloudflare Queue binding "${this.name}" not found in environment`)
    }

    await queue.send(job)
  }

  process(handler: JobHandler): void {
    const binding = (globalThis as Record<string, unknown>).env as Record<string, unknown> | undefined
    const queue = binding?.[this.name] as {
      consumer?: { on: (event: string, cb: (msg: { body: Job }) => void) => void }
    } | undefined

    if (queue?.consumer) {
      queue.consumer.on("message", (msg: { body: Job }) => {
        handler(msg.body).catch((err: unknown) => {
          console.error(`[queue:${this.name}] handler error`, err);
        })
      })
    }
  }
}

class LocalQueue implements Queue {
  private readonly handlers: JobHandler[] = []

  constructor(private readonly name: string) {}

  enqueue(job: Job): Promise<void> {
    console.log(`[queue:${this.name}] enqueued job ${job.id} (${job.type})`)

    for (const handler of this.handlers) {
      handler(job).catch((err: unknown) => {
        console.error(`[queue:${this.name}] handler error`, err);
      })
    }
    return Promise.resolve()
  }

  process(handler: JobHandler): void {
    this.handlers.push(handler)
  }
}

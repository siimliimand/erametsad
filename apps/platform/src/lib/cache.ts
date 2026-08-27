export interface Cache {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
}

export interface SSEBroadcast {
  publish(channel: string, event: unknown): Promise<void>
}

export function createCache(namespace: string): Cache {
  const binding = (globalThis as Record<string, unknown>).env as Record<string, unknown> | undefined
  const kv = binding?.[namespace] as { get: (k: string) => Promise<string | null>; put: (k: string, v: string, opts?: { expirationTtl?: number }) => Promise<void>; delete: (k: string) => Promise<void> } | undefined

  if (kv && typeof kv.get === "function") {
    return new KVCache(kv)
  }

  return new MemoryCache()
}

export function createSSEBroadcast(namespace: string): SSEBroadcast {
  const binding = (globalThis as Record<string, unknown>).env as Record<string, unknown> | undefined
  const kv = binding?.[namespace] as { get: (k: string) => Promise<string | null>; put: (k: string, v: string, opts?: { expirationTtl?: number }) => Promise<void> } | undefined

  if (kv && typeof kv.put === "function") {
    return new KVSSEBroadcast(kv)
  }

  return new MemorySSEBroadcast()
}

class KVCache implements Cache {
  constructor(private readonly kv: {
    get: (key: string) => Promise<string | null>
    put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void>
    delete: (key: string) => Promise<void>
  }) {}

  async get(key: string): Promise<string | null> {
    return this.kv.get(key)
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl !== undefined) {
      await this.kv.put(key, value, { expirationTtl: ttl })
    } else {
      await this.kv.put(key, value)
    }
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key)
  }
}

class MemoryCache implements Cache {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>()

  get(key: string): Promise<string | null> {
    const entry = this.store.get(key)

    if (!entry) return Promise.resolve(null)

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return Promise.resolve(null)
    }

    return Promise.resolve(entry.value)
  }

  set(key: string, value: string, ttl?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttl !== undefined ? Date.now() + ttl * 1000 : null,
    })
    return Promise.resolve()
  }

  delete(key: string): Promise<void> {
    this.store.delete(key)
    return Promise.resolve()
  }
}

class KVSSEBroadcast implements SSEBroadcast {
  constructor(private readonly kv: {
    get: (key: string) => Promise<string | null>
    put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void>
  }) {}

  async publish(channel: string, event: unknown): Promise<void> {
    const key = `sse:${channel}`
    const raw = await this.kv.get(key)
    const events: unknown[] = raw ? (JSON.parse(raw) as unknown[]) : []
    events.push({ ...(event as Record<string, unknown>), _published: Date.now() })
    await this.kv.put(key, JSON.stringify(events), { expirationTtl: 300 })
  }
}

class MemorySSEBroadcast implements SSEBroadcast {
  private readonly channels = new Map<string, { resolve: (event: unknown) => void }[]>()

  subscribe(channel: string): Promise<unknown> {
    return new Promise((resolve) => {
      const subs = this.channels.get(channel)
      if (subs) {
        subs.push({ resolve })
      } else {
        this.channels.set(channel, [{ resolve }])
      }
    })
  }

  publish(channel: string, event: unknown): Promise<void> {
    const subs = this.channels.get(channel) ?? []
    const entry = { ...(event as Record<string, unknown>), _published: Date.now() }

    for (const sub of subs) {
      sub.resolve(entry)
    }

    this.channels.set(channel, [])
    return Promise.resolve()
  }
}

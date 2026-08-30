/// <reference types="@cloudflare/vitest-pool-workers" />

// Minimal ambient types for the Durable Object spike. The full
// @cloudflare/workers-types package conflicts with src/lib/storage.ts's own R2
// declarations (it turns wrangler's unresolvable workers-types import into
// real globals), so the spike declares only the runtime shapes it uses.
declare module 'cloudflare:test' {
  interface ProvidedEnv {
    COUNTER: DurableObjectNamespace<import('./counter').CounterDO>
  }
}

interface DurableObjectId {
  toString(): string
  equals(other: DurableObjectId): boolean
}

interface DurableObjectStub<T = unknown> {
  fetch(input: string | Request, init?: RequestInit): Promise<Response>
}

interface DurableObjectNamespace<T = unknown> {
  newUniqueId(): DurableObjectId
  idFromName(name: string): DurableObjectId
  idFromString(id: string): DurableObjectId
  get(id: DurableObjectId): DurableObjectStub<T>
}

interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>
  put(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<boolean>
}

interface DurableObjectState {
  id: DurableObjectId
  storage: DurableObjectStorage
}

interface DurableObject {
  fetch?(request: Request): Response | Promise<Response>
  alarm?(): void | Promise<void>
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  props: Record<string, unknown>
  passThroughOnException(): void
}

interface WebSocketPair {
  0: WebSocket
  1: WebSocket
}
declare var WebSocketPair: { new (): WebSocketPair }

interface CloudflareEnv {
  COUNTER?: DurableObjectNamespace<import('./counter').CounterDO>
}

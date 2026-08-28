// Minimal ambient types for the `cloudflare:workers` module. The full
// @cloudflare/workers-types package conflicts with src/lib/storage.ts's own
// R2 declarations, so src/do declares only the runtime shapes it uses (same
// approach as the spike env types under spikes/*/spike-env.d.ts).
declare module 'cloudflare:workers' {
  export interface DurableObjectId {
    readonly name: string | undefined
    toString(): string
    equals(other: DurableObjectId): boolean
  }

  export interface DurableObjectStorage {
    get<T = unknown>(key: string): Promise<T | undefined>
    put(key: string, value: unknown): Promise<void>
    delete(key: string): Promise<boolean>
    deleteAll(): Promise<void>
  }

  export interface DurableObjectState {
    readonly id: DurableObjectId
    readonly storage: DurableObjectStorage
    setAlarm(timestamp: number): Promise<void>
    deleteAlarm(): Promise<boolean>
    getAlarm(): Promise<number | null>
    waitUntil(promise: Promise<unknown>): Promise<void>
  }

  export interface DurableObjectStub<T = unknown> {
    fetch(input: string | Request, init?: RequestInit): Promise<Response>
  }

  export interface DurableObjectNamespace<T = unknown> {
    newUniqueId(): DurableObjectId
    idFromName(name: string): DurableObjectId
    idFromString(id: string): DurableObjectId
    get(id: DurableObjectId): DurableObjectStub<T>
  }

  export class DurableObject<E = unknown> {
    protected readonly ctx: DurableObjectState
    protected readonly env: E
    constructor(ctx: DurableObjectState, env: E)
  }
}

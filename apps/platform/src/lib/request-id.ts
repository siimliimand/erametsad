import { AsyncLocalStorage } from 'async_hooks'

const requestIdStorage = new AsyncLocalStorage<string>()

export function getRequestId(): string | undefined {
  return requestIdStorage.getStore()
}

export function generateRequestId(): string {
  return crypto.randomUUID()
}

export function runWithRequestId<T>(id: string, fn: () => T): T {
  return requestIdStorage.run(id, fn)
}
export type SealedEventListener = (event: MessageEvent<string>) => void

/**
 * Minimal EventSource double for jsdom: records listeners so tests can
 * drive open/error transitions and sealed-event frames, and inspect the
 * stream URL the hook connected to.
 */
export class EventSourceStub {
  static instances: EventSourceStub[] = []

  readonly url: string
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  closed = false

  private readonly listeners = new Map<string, SealedEventListener[]>()

  constructor(url: string) {
    this.url = url
    EventSourceStub.instances.push(this)
  }

  addEventListener(type: string, listener: SealedEventListener): void {
    const existing = this.listeners.get(type) ?? []
    this.listeners.set(type, [...existing, listener])
  }

  close(): void {
    this.closed = true
  }

  open(): void {
    this.onopen?.()
  }

  fail(): void {
    this.onerror?.()
  }

  emit(type: string, data: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new MessageEvent<string>(type, { data }))
    }
  }
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

export type DomainEventType =
  | 'auction.published'
  | 'bid.created'
  | 'auction.ended'
  | 'contract.ready'
  | 'outbid'
  | 'auction.won'
  | 'bid.approved'
  | 'bid.rejected'

export interface DomainEvent {
  type: DomainEventType
  userId: string | number
  payload: Record<string, unknown>
}

type Handler = (event: DomainEvent) => void

export class EventBus {
  private handlers = new Map<string, Handler[]>()

  emit(event: DomainEvent): void {
    const handlers = this.handlers.get(event.type) ?? []
    for (const handler of handlers) {
      handler(event)
    }
  }

  on(eventType: string, handler: Handler): void {
    const existing = this.handlers.get(eventType) ?? []
    existing.push(handler)
    this.handlers.set(eventType, existing)
  }
}

// Next dev compiles instrumentation.ts and route handlers into separate
// module graphs, so a module-level singleton would give each context its
// own bus and route-emitted events would never reach the dispatcher.
// globalThis is shared by every bundle in the process.
const globalForBus = globalThis as unknown as { __erametsadEventBus?: EventBus }
export const eventBus: EventBus = globalForBus.__erametsadEventBus ?? new EventBus()
globalForBus.__erametsadEventBus = eventBus
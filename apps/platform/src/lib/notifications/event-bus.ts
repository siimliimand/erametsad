export type DomainEventType = 'bid.created' | 'auction.ended' | 'contract.ready' | 'outbid' | 'auction.won'

export interface DomainEvent {
  type: DomainEventType
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

export const eventBus = new EventBus()
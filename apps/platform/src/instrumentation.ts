let bootstrapStarted = false

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // Next dev can invoke register() again on hot reload; keep one scheduler
  // and one dispatcher per process.
  if (bootstrapStarted) return
  bootstrapStarted = true

  const { scheduleAuctionEnding } = await import('./lib/workers/auction-ending')
  const { startListening } = await import('./lib/notifications/service')
  const { eventBus } = await import('./lib/notifications/event-bus')

  startListening(eventBus)
  scheduleAuctionEnding(30_000)
}

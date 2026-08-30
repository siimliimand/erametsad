let bootstrapStarted = false

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // Next dev can invoke register() again on hot reload; keep one
  // dispatcher per process.
  if (bootstrapStarted) return
  bootstrapStarted = true

  // Auction ending no longer runs here: AuctionDO alarms own the end
  // transition and the Worker cron sweep (scheduled handler) is the safety
  // net.
  const { startListening } = await import('./lib/notifications/service')
  const { eventBus } = await import('./lib/notifications/event-bus')

  startListening(eventBus)
}

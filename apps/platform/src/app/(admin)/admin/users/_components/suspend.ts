export const suspendDurations = ['24h', '7d', 'indefinite'] as const

export type SuspendDuration = (typeof suspendDurations)[number]

export const suspendDurationLabels: Record<SuspendDuration, string> = {
  '24h': '24 tundi',
  '7d': '7 päeva',
  indefinite: 'Tähtajatu',
}

export function isSuspendDuration(value: string): value is SuspendDuration {
  return (suspendDurations as readonly string[]).includes(value)
}

/** Suspension end timestamp for a finite duration; indefinite stays open. */
export function suspendedUntil(duration: SuspendDuration, from: Date = new Date()): string | null {
  const ms = duration === '24h' ? 24 * 60 * 60 * 1000 : duration === '7d' ? 7 * 24 * 60 * 60 * 1000 : null
  return ms === null ? null : new Date(from.getTime() + ms).toISOString()
}

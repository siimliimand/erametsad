export function inList(values: readonly string[]): string {
  return `('${values.join("', '")}')`
}

export const auctionObjectTypes = ['raieoigus', 'kinnistu', 'kiire', 'pakett'] as const
export type AuctionObjectType = (typeof auctionObjectTypes)[number]

export const notificationChannels = ['email', 'sms', 'in_app'] as const
export type NotificationChannel = (typeof notificationChannels)[number]

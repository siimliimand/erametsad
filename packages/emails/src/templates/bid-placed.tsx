export function bidPlatedTemplate(params: { amount: number; auctionTitle: string }): string {
  return `Teie pakkumus ${params.amount.toFixed(2)} € oksjonil "${params.auctionTitle}" on registreeritud.`
}

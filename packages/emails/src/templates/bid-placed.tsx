// Transactional (bid confirmation). GDPR exempts service email from
// List-Unsubscribe headers; reviewed, no change needed.
export function bidPlatedTemplate(params: { amount: number; auctionTitle: string }): string {
  return `Teie pakkumus ${params.amount.toFixed(2)} € oksjonil "${params.auctionTitle}" on registreeritud.`
}

export function bidPlatedTemplate(params: { amount: number; auctionTitle: string }): string {
  return `Your bid of €${params.amount.toFixed(2)} has been placed on auction ${params.auctionTitle}`
}
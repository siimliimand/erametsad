export function auctionWonTemplate(params: { auctionTitle: string; winningBid: number }): string {
  return `Congratulations! You won auction ${params.auctionTitle} for €${params.winningBid.toFixed(2)}`
}
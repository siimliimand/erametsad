export function auctionEndedTemplate(params: { auctionTitle: string; finalPrice: number }): string {
  return `Auction ${params.auctionTitle} has ended — final price €${params.finalPrice.toFixed(2)}`
}
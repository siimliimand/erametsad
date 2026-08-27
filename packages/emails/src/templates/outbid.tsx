export function outbidTemplate(params: { auctionTitle: string; currentBid: number }): string {
  return `You've been outbid on auction ${params.auctionTitle} — current bid is €${params.currentBid.toFixed(2)}`
}
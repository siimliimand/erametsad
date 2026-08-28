// Transactional (won-auction notice). GDPR exempts it from
// List-Unsubscribe headers; reviewed, no change needed.
export function auctionWonTemplate(params: { auctionTitle: string; winningBid: number }): string {
  return `Palju õnne! Võitsite oksjoni "${params.auctionTitle}" pakkumusega ${params.winningBid.toFixed(2)} €.`
}

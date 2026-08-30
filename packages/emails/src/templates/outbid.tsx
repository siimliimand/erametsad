// Transactional (outbid notice, triggered by auction activity). GDPR
// exempts it from List-Unsubscribe headers; reviewed, no change needed.
export function outbidTemplate(params: { auctionTitle: string; currentBid: number }): string {
  return `Teie pakkumus oksjonil "${params.auctionTitle}" on üle pakutud. Uus parim pakkumus on ${params.currentBid.toFixed(2)} €.`
}

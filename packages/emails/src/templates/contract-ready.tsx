// Transactional (contract ready for signature). GDPR exempts it from
// List-Unsubscribe headers; reviewed, no change needed.
export function contractReadyTemplate(params: { auctionTitle: string }): string {
  return `Oksjoni "${params.auctionTitle}" leping on allkirjastamiseks valmis.`
}

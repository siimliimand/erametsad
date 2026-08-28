export function auctionEndedTemplate(params: {
  auctionTitle: string
  finalPrice?: number
}): string {
  // Unsold and sealed-end events carry no finalPrice; the sentence must
  // not crash the whole notification dispatch on the missing amount.
  if (params.finalPrice === undefined) {
    return `Oksjon "${params.auctionTitle}" on lõppenud.`
  }
  return `Oksjon "${params.auctionTitle}" on lõppenud. Lõpphind on ${params.finalPrice.toFixed(2)} €.`
}

export function auctionEndedTemplate(params: { auctionTitle: string; finalPrice: number }): string {
  return `Oksjon "${params.auctionTitle}" on lõppenud. Lõpphind on ${params.finalPrice.toFixed(2)} €.`
}

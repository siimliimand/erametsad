export { bidPlatedTemplate } from './templates/bid-placed'
export { outbidTemplate } from './templates/outbid'
export { auctionWonTemplate } from './templates/auction-won'
export { auctionEndedTemplate } from './templates/auction-ended'

export interface EmailTemplateParams {
  bidPlaced: { amount: number; auctionTitle: string }
  outbid: { auctionTitle: string; currentBid: number }
  auctionWon: { auctionTitle: string; winningBid: number }
  auctionEnded: { auctionTitle: string; finalPrice: number }
}
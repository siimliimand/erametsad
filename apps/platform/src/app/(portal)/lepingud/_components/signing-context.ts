import { priceSummaryCents, type PriceSummaryCents } from './price-summary'

import type { AuctionDoc, CoreRepositories } from '@/lib/data/repositories'

const OBJECT_TYPE_LABELS: Record<AuctionDoc['objectType'], string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Metskinnistu',
  kiire: 'Kiiroksjon',
  pakett: 'Pakett',
}

const LOGGING_DEADLINE_KEYS = ['loggingDeadline', 'logging', 'raie'] as const
const REMOVAL_DEADLINE_KEYS = ['removalDeadline', 'removal'] as const

export interface AuctionSigningContext {
  countyName: string | null
  areaHa: number | null
  objectTypeLabel: string | null
  /** "Sinu pimepakkumine võitis avamisel 29.08.2026" style winner line. */
  wonText: string | null
  price: PriceSummaryCents | null
  loggingDeadline: string | null
  removalDeadline: string | null
}

function fmtDate(value: string): string | null {
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  return new Date(time).toLocaleDateString('et-EE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Tolerant read over the free-form deadlines TEXT-JSON, as the lot page does. */
function deadlineText(deadlines: unknown, keys: readonly string[]): string | null {
  if (typeof deadlines !== 'object' || deadlines === null) return null
  const record = deadlines as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim() !== '') {
      return fmtDate(value) ?? value
    }
  }
  return null
}

async function settingsFeePercent(repositories: CoreRepositories): Promise<number | null> {
  const { docs } = await repositories.find({ collection: 'settings', limit: 1 })
  const feePercent = docs[0]?.feePercent
  return typeof feePercent === 'number' ? feePercent : null
}

/**
 * Server-side context for the auction contract's Andmed step: winner line,
 * price summary (lõpphind + 3% teenustasu + 22% käibemaks on the fee) and
 * payment/cutting terms. All display-only — the signing API calls keep
 * taking only auctionId/contractId.
 */
export async function loadAuctionSigningContext(
  repositories: CoreRepositories,
  auction: AuctionDoc,
  winningBid: { amountCents: number; type: string; createdAt: string } | null,
): Promise<AuctionSigningContext> {
  const [county, feePercentFromSettings] = await Promise.all([
    auction.countyId !== null
      ? repositories.findByID({ collection: 'counties', id: auction.countyId })
      : Promise.resolve(null),
    settingsFeePercent(repositories),
  ])

  const wonDate =
    winningBid !== null
      ? (fmtDate(winningBid.createdAt) ?? null)
      : auction.endedAt !== null
        ? (fmtDate(auction.endedAt) ?? null)
        : null
  const wonText =
    wonDate !== null && winningBid !== null
      ? winningBid.type === 'sealed'
        ? `Sinu pimepakkumine võitis avamisel ${wonDate}`
        : `Sinu pakkumine võitis oksjoni ${wonDate}`
      : wonDate !== null
        ? `Sinu pakkumine võitis oksjoni ${wonDate}`
        : null

  const finalPriceCents = auction.finalPriceCents ?? winningBid?.amountCents ?? null
  const price =
    finalPriceCents !== null && finalPriceCents > 0
      ? priceSummaryCents(
          finalPriceCents,
          typeof auction.feeOverridePercent === 'number'
            ? auction.feeOverridePercent
            : feePercentFromSettings,
        )
      : null

  return {
    countyName: county?.name ?? null,
    areaHa: auction.areaHa ?? null,
    objectTypeLabel: OBJECT_TYPE_LABELS[auction.objectType],
    wonText,
    price,
    loggingDeadline: deadlineText(auction.deadlines, LOGGING_DEADLINE_KEYS),
    removalDeadline: deadlineText(auction.deadlines, REMOVAL_DEADLINE_KEYS),
  }
}

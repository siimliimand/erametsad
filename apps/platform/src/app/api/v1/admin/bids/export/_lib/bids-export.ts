import { bidSourceLabels, bidStatusLabels } from '@/app/(admin)/_lib/labels'
import type { Bid } from '@/lib/data/schema'

/**
 * Pure helpers for the bids CSV export route (task 6.1, design
 * 04-bids-monitoring "Export format"). Same CSV dialect as the other admin
 * exports: semicolon delimiter (Estonian Excel), UTF-8 BOM, CRLF rows.
 * Bidder identity columns stay blank unless the exporter holds an admin
 * role; the "Pakkuja (anonüümne)" label is the feed-local alias, so the
 * export never widens identity access beyond the audited reveal flow.
 */

export interface BidExportRow {
  submittedAt: string
  anonymizedLabel: string
  bidderId: string
  bidderName: string
  amount: string
  source: string
  status: string
  isUnderbid: string
  ipHash: string
}

export const BID_CSV_HEADERS = [
  'Esitatud',
  'Pakkuja (anonüümne)',
  'Pakkuja ID',
  'Pakkuja nimi',
  'Summa (EUR)',
  'Allikas',
  'Olek',
  'Alapakkumine',
  'IP räsi',
] as const

export interface BidExportContext {
  /** Feed-local alias per bidder id ("Pakkuja #N", oldest bid first). */
  aliasByUserId: ReadonlyMap<string, number>
  /** Real display names; only populated for admin/superadmin exporters. */
  nameByUserId: ReadonlyMap<string, string>
  includeIdentity: boolean
}

const CSV_DELIMITER = ';'
const CSV_BOM = '\uFEFF'
const CSV_ROW_SEPARATOR = '\r\n'

function formatCsvField(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function eur(cents: number): string {
  return (cents / 100).toFixed(2)
}

/**
 * The bid ledger has no persistent is_underbid flag: place-bid writes an
 * under-start bid as `pending_approval` and the decision moves it to
 * leading/rejected, so pending_approval is the only domain signal.
 */
export function isUnderbidBid(bid: Pick<Bid, 'status'>): boolean {
  return bid.status === 'pending_approval'
}

export function buildBidExportRows(
  bids: readonly Bid[],
  context: BidExportContext,
): BidExportRow[] {
  return bids.map((bid) => {
    const alias = context.aliasByUserId.get(bid.userId)
    return {
      submittedAt: bid.createdAt,
      anonymizedLabel: alias !== undefined ? `Pakkuja #${String(alias)}` : '',
      bidderId: context.includeIdentity ? bid.userId : '',
      bidderName: context.includeIdentity
        ? (context.nameByUserId.get(bid.userId) ?? '')
        : '',
      // Sealed rows store 0 cents (the amount lives in the envelope), and
      // sealed sums stay hidden until the opening ceremony.
      amount: bid.type === 'sealed' ? '' : eur(bid.amountCents),
      source: bidSourceLabels[bid.source],
      status: bidStatusLabels[bid.status],
      isUnderbid: isUnderbidBid(bid) ? 'jah' : 'ei',
      ipHash: bid.ipHash ?? '',
    }
  })
}

export function buildBidsCsv(rows: readonly BidExportRow[]): string {
  const lines = [
    BID_CSV_HEADERS.join(CSV_DELIMITER),
    ...rows.map((row) =>
      [
        row.submittedAt,
        row.anonymizedLabel,
        row.bidderId,
        row.bidderName,
        row.amount,
        row.source,
        row.status,
        row.isUnderbid,
        row.ipHash,
      ]
        .map(formatCsvField)
        .join(CSV_DELIMITER),
    ),
  ]
  return `${CSV_BOM}${lines.join(CSV_ROW_SEPARATOR)}${CSV_ROW_SEPARATOR}`
}

export function buildBidsExportFilename(auctionId: string, now: Date): string {
  return `pakkumised-${auctionId}-${now.toISOString().slice(0, 10)}.csv`
}

import type { MyBidRow } from './types'

type PillTone = 'positive' | 'negative' | 'pending' | 'neutral'

const TONE_CLASSES: Record<PillTone, string> = {
  positive: 'bg-primaryLight text-primaryDark',
  negative: 'bg-dangerLight text-danger',
  pending: 'bg-infoLight text-info',
  neutral: 'bg-bgMist text-inkMuted',
}

// Sealed statuses stay internal until the admin opening ceremony, so every
// sealed row reads "Esitatud" regardless of the stored bid status.
function activePill(row: MyBidRow): { label: string; tone: PillTone } {
  if (row.auction.auctionType === 'sealed') {
    return { label: 'Esitatud', tone: 'neutral' }
  }
  switch (row.myBid?.status) {
    case 'leading':
      return { label: 'Juhtiv', tone: 'positive' }
    case 'outbid':
      return { label: 'Üle pakutud', tone: 'negative' }
    case 'pending_approval':
      return { label: 'Ootel (alapakkumine)', tone: 'pending' }
    default:
      return { label: 'Esitatud', tone: 'neutral' }
  }
}

function endedPill(row: MyBidRow): { label: string; tone: PillTone } {
  switch (row.outcome) {
    case 'won':
      return { label: 'Võitsid', tone: 'positive' }
    case 'lost':
      return { label: 'Ei võitnud', tone: 'negative' }
    case 'unsold':
      return { label: 'Jäi müümata', tone: 'neutral' }
    default:
      return { label: 'Avamine ootel', tone: 'pending' }
  }
}

export function BidStatusPill({
  row,
  ended = false,
}: {
  row: MyBidRow
  ended?: boolean
}) {
  const { label, tone } = ended ? endedPill(row) : activePill(row)
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-pill px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  )
}

import { StatusPill } from '@erametsad/ui'

import type { MyBidRow } from './types'

type LocalPillTone = 'negative' | 'pending' | 'neutral' | 'soon'

// Same shape as the shared StatusPill (md size); tones follow the demo pill
// palette. Local pills cover the portal-only labels StatusPill does not carry.
const LOCAL_TONE_CLASSES: Record<LocalPillTone, string> = {
  negative: 'bg-dangerLight text-danger',
  pending: 'bg-infoLight text-info',
  neutral: 'bg-bgMist text-inkMuted',
  soon: 'bg-cta/10 text-ctaHover',
}

function LocalPill({ label, tone }: { label: string; tone: LocalPillTone }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${LOCAL_TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  )
}

// Sealed statuses stay internal until the admin opening ceremony, so every
// sealed card reads "Ootel avamine" regardless of the stored bid status.
// Labels the shared StatusPill carries (Juhtiv pakkumine, Ootel avamine,
// Võitsid, Ei võitnud, Müümata) render through it.
export function BidStatusPill({
  row,
  ended = false,
}: {
  row: MyBidRow
  ended?: boolean
}) {
  if (ended) {
    switch (row.outcome) {
      case 'won':
        return <StatusPill status="won" size="sm" />
      case 'lost':
        return <StatusPill status="lost" size="sm" />
      case 'unsold':
        return <StatusPill status="unsold" size="sm" />
      default:
        return <StatusPill status="sealedOpeningPending" size="sm" />
    }
  }
  if (row.auction.auctionType === 'sealed') {
    return <StatusPill status="sealedOpeningPending" size="sm" />
  }
  switch (row.myBid?.status) {
    case 'leading':
      return <StatusPill status="leading" size="sm" />
    case 'outbid':
      return <LocalPill label="Üle pakutud" tone="negative" />
    case 'pending_approval':
      return <LocalPill label="Ootel (alapakkumine)" tone="pending" />
    default:
      return <LocalPill label="Esitatud" tone="neutral" />
  }
}

// Won auction with a contract prepared but not yet signed (demo .pill-soon).
export function ContractPendingPill() {
  return <LocalPill label="Leping allkirja ootel" tone="soon" />
}

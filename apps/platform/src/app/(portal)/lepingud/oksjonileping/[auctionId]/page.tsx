import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { loadContractSnapshot } from '../../_components/contract-state'
import { SigningFlow } from '../../_components/signing-flow'
import { SigningShell } from '../../_components/signing-shell'

import { requirePortalSession } from '@/app/(portal)/_lib/session'
import { getRepositories } from '@/lib/data/runtime'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Oksjonileping',
}

interface OksjonilepingPageProps {
  params: Promise<{ auctionId: string }>
}

// The deadlines column is free-form TEXT-JSON; read it tolerantly the same
// way the lot page does, with the signing deadline under any known key.
const DEADLINE_KEYS = ['contractDeadline', 'contractSigningDeadline', 'signingDeadline'] as const

function signingDeadline(deadlines: unknown): string | null {
  if (typeof deadlines !== 'object' || deadlines === null) return null
  const record = deadlines as Record<string, unknown>
  for (const key of DEADLINE_KEYS) {
    const value = record[key]
    if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
      return value
    }
  }
  return null
}

export default async function OksjonilepingPage({ params }: OksjonilepingPageProps) {
  const { auctionId } = await params
  const currentPath = `/lepingud/oksjonileping/${auctionId}`
  const { session } = await requirePortalSession(currentPath)

  const repos = await getRepositories()
  const auction = await repos.findByID({ collection: 'auctions', id: auctionId })
  if (auction === null) notFound()

  const snapshot = await loadContractSnapshot(repos, 'auction', auctionId, session.userId)

  // Non-signed states stay winner-only: an unsigned contract row has no owner
  // on the mock service, so the winner check is the scoping mechanism here.
  let gate: 'ok' | 'no-winner' | 'not-winner' = 'ok'
  if (snapshot.status !== 'signed') {
    const isAdmin = session.role === 'admin' || session.role === 'superadmin'
    const winningBidId = typeof auction.winningBid === 'string' ? auction.winningBid : null
    if (winningBidId === null) {
      gate = 'no-winner'
    } else if (!isAdmin) {
      const bid = await repos.findByID({ collection: 'bids', id: winningBidId })
      if (bid?.userId !== session.userId) {
        gate = 'not-winner'
      }
    }
  }

  return (
    <SigningShell>
      {gate !== 'ok' ? (
        <div className="rounded-card border border-border bg-white p-lg shadow-card">
          <h1 className="font-heading text-h3 text-ink">Oksjonileping</h1>
          <p className="mt-2xs font-body text-body text-inkMuted">
            {gate === 'no-winner'
              ? 'Sellele oksjonile ei ole veel võitjat määratud, seega lepingut ei ole võimalik koostada.'
              : 'Lepingu koostamise õigus on ainult oksjoni võitjal.'}
          </p>
          <p className="mt-md">
            <Link
              href={`/oksjon/${auctionId}`}
              className="font-label font-semibold text-primary underline-offset-2 hover:underline"
            >
              Vaata oksjonit
            </Link>
          </p>
        </div>
      ) : (
        <SigningFlow
          kind="auction"
          auctionId={auctionId}
          auctionTitle={auction.title}
          templateVersion={snapshot.templateVersion}
          initial={snapshot}
          identity={null}
          nextPath={null}
          deadlineIso={signingDeadline(auction.deadlines)}
        />
      )}
    </SigningShell>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'

import { loadContractSnapshot } from '../_components/contract-state'
import { SigningFlow, type IdentityPrefill } from '../_components/signing-flow'
import { SigningShell } from '../_components/signing-shell'

import { requirePortalSession } from '@/app/(portal)/_lib/session'
import { getRepositories } from '@/lib/data/runtime'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Raamleping',
}

type RawSearchParams = Record<string, string | string[] | undefined>

interface RaamlepingPageProps {
  searchParams: Promise<RawSearchParams>
}

// Only same-origin paths may travel through ?next=: local absolute form,
// never the protocol-relative //host form (open-redirect vector).
function sameOriginPath(candidate: string | null): string | null {
  if (candidate === null || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return null
  }
  return candidate
}

function firstParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === undefined || raw.trim() === '') return null
  return raw
}

// The prepare endpoint is auction-scoped, so the framework flow derives its
// auction context from ?next=/oksjon/:id (the bid-gate round trip).
function auctionIdFromNext(next: string): string | null {
  const match = /^\/oksjon\/([^/?#]+)$/.exec(next)
  return match?.[1] ?? null
}

export default async function RaamlepingPage({ searchParams }: RaamlepingPageProps) {
  const params = await searchParams
  const nextPath = sameOriginPath(firstParam(params.next))
  const gateMessage = firstParam(params.message)
  const auctionId = nextPath !== null ? auctionIdFromNext(nextPath) : null

  const query = new URLSearchParams()
  if (nextPath !== null) query.set('next', nextPath)
  if (gateMessage !== null) query.set('message', gateMessage)
  const queryString = query.toString()
  const currentPath = '/lepingud/raamleping' + (queryString !== '' ? `?${queryString}` : '')
  const { session, profile } = await requirePortalSession(currentPath)

  const repos = await getRepositories()

  const blocked =
    profile !== null && profile.type === 'company' && profile.approvalStatus !== 'approved'

  const userRecord = (await repos.findByID({ collection: 'users', id: session.userId })) as
    | Record<string, unknown>
    | null

  const identity: IdentityPrefill = {
    name:
      profile?.displayName ??
      profile?.companyName ??
      (typeof userRecord?.name === 'string' ? userRecord.name : ''),
    codeLabel: profile?.type === 'company' ? 'Registrikood' : 'Isikukood',
    code:
      profile?.type === 'company'
        ? (profile.companyRegCode ?? '')
        : typeof userRecord?.isikukood === 'string'
          ? userRecord.isikukood
          : '',
    address: '',
    email: typeof userRecord?.email === 'string' ? userRecord.email : '',
    phone: profile?.phone ?? (typeof userRecord?.phone === 'string' ? userRecord.phone : ''),
  }

  const snapshot = await loadContractSnapshot(repos, 'framework', auctionId, session.userId)

  let activeVersion: string | null = null
  if (snapshot.templateVersion === null) {
    const active = await repos.find({
      collection: 'contract-templates',
      where: { and: [{ type: { equals: 'framework' } }, { active: { equals: true } }] },
      limit: 1,
    })
    activeVersion = active.docs[0]?.version ?? null
  }

  return (
    <SigningShell>
      <div className="flex flex-col gap-md">
        {gateMessage !== null && (
          <p
            role="status"
            className="rounded-card border border-info/30 bg-infoLight px-md py-sm font-body text-body font-semibold text-ink"
          >
            {gateMessage}
          </p>
        )}

        {blocked ? (
          <div className="rounded-card border border-border bg-white p-lg shadow-card">
            <h1 className="font-heading text-h3 text-ink">Raamleping</h1>
            <p className="mt-2xs font-body text-body text-inkMuted">
              Ettevõtte profiil pole veel kinnitatud. Allkirjastamine avaneb pärast kinnitamist.
            </p>
            <p className="mt-md">
              <Link
                href="/user/profile"
                className="font-label font-semibold text-primary underline-offset-2 hover:underline"
              >
                Vaata profiili
              </Link>
            </p>
          </div>
        ) : (
          <SigningFlow
            kind="framework"
            auctionId={auctionId}
            auctionTitle={null}
            templateVersion={snapshot.templateVersion ?? activeVersion}
            initial={snapshot}
            identity={identity}
            nextPath={nextPath}
            deadlineIso={null}
          />
        )}
      </div>
    </SigningShell>
  )
}

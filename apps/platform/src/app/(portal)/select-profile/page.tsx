import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ProfileSelector, type ProfileOption } from './_components/ProfileCard'

import { requirePortalSession } from '@/app/(portal)/_lib/session'
import type { ProfileDoc } from '@/lib/data/repositories/registry'
import { auctionObjectTypes } from '@/lib/data/schema'
import type { AuctionRight } from '@/lib/data/schema'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Vali profiil',
}

// Same rule as login/page.tsx and (portal)/_lib/session.ts: only local
// absolute paths travel through ?next=; the protocol-relative //host form
// is an open redirect.
function safeNext(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null
  }
  return value
}

// Rights are granted per user (auction_rights.user_id), not per profile, so
// the same summary shows on every card. Newest row per object type decides;
// a revoked row means no active right — mirrors GET /api/v1/my/auction-rights.
function grantedObjectTypes(rights: AuctionRight[]): (typeof auctionObjectTypes)[number][] {
  const latest = new Map<string, AuctionRight>()
  for (const right of rights) {
    if (!latest.has(right.objectType)) {
      latest.set(right.objectType, right)
    }
  }
  return auctionObjectTypes.filter((objectType) => {
    const row = latest.get(objectType)
    return row?.revokedAt === null
  })
}

function toOption(profile: ProfileDoc, activeProfileId: string | null): ProfileOption {
  const isCompany = profile.type === 'company'
  const name =
    (isCompany ? (profile.companyName ?? profile.displayName) : profile.displayName) ??
    (isCompany ? 'Ettevõte' : 'Eraisik')
  const selectable = !isCompany || profile.approvalStatus === 'approved'
  return {
    id: profile.id,
    type: profile.type,
    name,
    regCode: isCompany ? (profile.companyRegCode ?? null) : null,
    active: profile.id === activeProfileId,
    disabled: !selectable,
    note: selectable
      ? null
      : profile.approvalStatus === 'rejected'
        ? 'Ettevõtte taotlus lükati tagasi.'
        : 'Ettevõtte profiil ootab kinnitust.',
  }
}

export default async function SelectProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const next = safeNext((await searchParams).next)
  // Passing the destination as nextPath keeps it alive through a re-login
  // loop: login returns here only while profiles > 1, otherwise straight on.
  const { session, repositories } = await requirePortalSession(next ?? undefined)

  const { docs } = await repositories.find({ collection: 'profile' })

  // Single-profile users never see this page — resolve server-side so the
  // client never flashes the card grid.
  if (docs.length <= 1) {
    redirect(next ?? '/')
  }

  const rightsResult = await repositories.find({
    collection: 'auction-rights',
    where: { user: { equals: session.userId } },
    sort: '-grantedAt',
  })

  return (
    <div className="mx-auto w-full max-w-container-sm">
      <div className="rounded-card border border-border bg-bgPage p-md shadow-card md:p-lg">
        <h1 className="font-heading text-h2 text-ink">Vali profiil</h1>
        <p className="mt-2xs font-body text-body text-inkMuted">
          Vali, millise profiiliga portaalis jätkatakse. Edasised tegevused seotak valitud
          profiiliga.
        </p>
        <div className="mt-md">
          <ProfileSelector
            options={docs.map((profile) => toOption(profile, session.profileId))}
            activeProfileId={session.profileId}
            grantedTypes={grantedObjectTypes(rightsResult.docs)}
            next={next}
          />
        </div>
      </div>
    </div>
  )
}

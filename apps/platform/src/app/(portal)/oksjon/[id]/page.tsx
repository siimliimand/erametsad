import { MapEstonia, StatusPill } from '@erametsad/ui'
import { ExternalLink, Lock } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AnchorTabs } from './_components/AnchorTabs'
import { BidList } from './_components/BidList'
import { DocumentList } from './_components/DocumentList'
import {
  DossierTable,
  PackageSection,
  type DossierRow,
} from './_components/DossierTable'
import { FactsCard } from './_components/FactsCard'
import { Gallery, type GalleryImage } from './_components/Gallery'
import { LiveBidPanel } from './_components/LiveBidPanel'
import { LiveCountdown } from './_components/LiveCountdown'
import { LotHeadBand } from './_components/LotHeadBand'
import { RichText, richTextBlocks } from './_components/RichText'
import { SellerContact } from './_components/SellerContact'
import {
  SealedBidPanel,
  type SealedViewerSnapshot,
} from './_components/sealed/SealedBidPanel'

import {
  getPortalAuthState,
  getActiveProfile,
} from '@/app/(portal)/_lib/session'
import { AuctionStreamProvider } from '@/app/(portal)/_lib/use-auction-stream'
import {
  getAuctionBids,
  getAuctionDossier,
  type AuctionDossier,
} from '@/lib/auction/queries'
import type { CoreRepositories } from '@/lib/data/repositories'
import { centsToEuros } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'

type PillStatus = React.ComponentProps<typeof StatusPill>['status']

export const dynamic = 'force-dynamic'

// ── Formatting ──────────────────────────────────────────────────────────

function eur(value: number): string {
  // Demo shows whole euros ("12 000 €"); cents appear only when they exist.
  return value.toLocaleString('et-EE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function num(value: number): string {
  return value.toLocaleString('et-EE', { maximumFractionDigits: 2 })
}

function fmtDate(value: string): string | null {
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  return new Date(time).toLocaleDateString('et-EE', { dateStyle: 'long' })
}

/** Demo D.M.YYYY kl HH:MM deadline line. */
function fmtDeadline(value: string): string | null {
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  const date = new Date(time)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${String(date.getDate())}.${String(date.getMonth() + 1)}.${String(
    date.getFullYear(),
  )} kl ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ── Object-type naming (crumbs, rail type line) ─────────────────────────

const OBJECT_TYPE_LABELS: Record<
  AuctionDossier['objectType'],
  { singular: string; plural: string; tab: string }
> = {
  raieoigus: { singular: 'Raieõigus', plural: 'Raieõigused', tab: 'raieoigused' },
  kinnistu: {
    singular: 'Metskinnistu',
    plural: 'Metskinnistud',
    tab: 'metskinnistud',
  },
  kiire: {
    singular: 'Kiiroksjon',
    plural: 'Kiiroksjonid',
    tab: 'kiiroksjonid',
  },
  pakett: { singular: 'Pakett', plural: 'Paketid', tab: 'paketid' },
  pollumaa: {
    singular: 'Põllumaa',
    plural: 'Põllumaad',
    tab: 'polumaad',
  },
}

// ── Media / files ───────────────────────────────────────────────────────

interface MediaEntry {
  id: string | null
  url: string | null
  filename: string | null
  mimeType: string | null
  filesize: number | null
}

function mediaEntryOf(value: unknown): MediaEntry | null {
  if (typeof value === 'string') {
    return {
      id: value,
      url: null,
      filename: null,
      mimeType: null,
      filesize: null,
    }
  }
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id : null
  const url =
    typeof record.url === 'string' && record.url !== '' ? record.url : null
  if (id === null && url === null) return null
  return {
    id,
    url,
    filename: typeof record.filename === 'string' ? record.filename : null,
    mimeType: typeof record.mimeType === 'string' ? record.mimeType : null,
    filesize: typeof record.filesize === 'number' ? record.filesize : null,
  }
}

function srcOf(entry: MediaEntry): string | null {
  if (
    entry.url &&
    (entry.url.startsWith('/') || entry.url.startsWith('http'))
  ) {
    return entry.url
  }
  return entry.id !== null ? `/api/v1/media/${entry.id}` : null
}

function isImage(entry: MediaEntry): boolean {
  if (entry.mimeType !== null) return entry.mimeType.startsWith('image/')
  const name = entry.filename ?? entry.url ?? ''
  return /\.(png|jpe?g|webp|gif|avif)$/i.test(name)
}

function galleryImages(entries: unknown[], title: string): GalleryImage[] {
  return entries
    .map(mediaEntryOf)
    .filter((entry): entry is MediaEntry => entry !== null && isImage(entry))
    .map((entry) => ({ src: srcOf(entry) ?? '', alt: entry.filename ?? title }))
    .filter((image) => image.src !== '')
}

function fileSizeLabel(bytes: number | null): string | undefined {
  if (bytes === null || bytes <= 0) return undefined
  if (bytes < 1024 * 1024)
    return `${String(Math.max(1, Math.round(bytes / 1024)))} kB`
  return `${(bytes / (1024 * 1024)).toLocaleString('et-EE', { maximumFractionDigits: 1 })} MB`
}

function formatOf(entry: MediaEntry): string | undefined {
  if (entry.mimeType === 'application/pdf') return 'PDF'
  const name = entry.filename ?? ''
  const match = /\.([a-z0-9]{2,4})$/i.exec(name)
  const extension = match !== null ? match[1] : undefined
  return extension !== undefined ? extension.toUpperCase() : undefined
}

interface FileLink {
  title: string
  href: string
  size?: string
  format?: string
}

function fileLinks(entries: unknown[]): FileLink[] {
  return entries
    .map(mediaEntryOf)
    .filter((entry): entry is MediaEntry => entry !== null && !isImage(entry))
    .map((entry) => ({ entry, src: srcOf(entry) }))
    .filter(
      (item): item is { entry: MediaEntry; src: string } => item.src !== null,
    )
    .map(({ entry, src }): FileLink => {
      const size = fileSizeLabel(entry.filesize)
      const format = formatOf(entry)
      return {
        title: entry.filename ?? `Dokument ${entry.id ?? ''}`.trim(),
        href: src,
        ...(size !== undefined ? { size } : {}),
        ...(format !== undefined ? { format } : {}),
      }
    })
}

// ── Deadlines / approvals (tolerant over the free-form deadlines JSON) ──

function deadlineValue(
  deadlines: unknown,
  keys: readonly string[],
): string | null {
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

function approvalLabel(
  deadlines: unknown,
  keys: readonly string[],
): string | null {
  if (typeof deadlines !== 'object' || deadlines === null) return null
  const record = deadlines as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (value === true || value === 'buyer' || value === 'ostja') {
      return 'Kooskõlastab ostja'
    }
  }
  return null
}

function rentalLabel(deadlines: unknown): string | null {
  if (typeof deadlines !== 'object' || deadlines === null) return null
  const record = deadlines as Record<string, unknown>
  const has =
    record.hasRentalAgreement === true ||
    record.hasRentalAgreement === 'true' ||
    record.rentalAgreement === true
  if (!has) return null
  const until = deadlineValue(deadlines, [
    'rentalAgreementDeadline',
    'rentalDeadline',
  ])
  return until !== null ? `Jah, kuni ${until}` : 'Jah'
}

function notificationNumbers(entries: unknown[]): string[] {
  return entries
    .map((entry) => {
      if (typeof entry === 'string' && entry.trim() !== '') return entry.trim()
      if (typeof entry === 'object' && entry !== null) {
        const record = entry as Record<string, unknown>
        for (const key of ['nr', 'number', 'metsateatis']) {
          const value = record[key]
          if (typeof value === 'string' && value.trim() !== '')
            return value.trim()
        }
      }
      return null
    })
    .filter((value): value is string => value !== null)
}

// ── Framework contract gate (pre-submit mirror of place-bid.ts step 7) ──

type GateCollection = 'settings' | 'contract-templates' | 'contracts'

async function findGateDoc(
  repositories: CoreRepositories,
  collection: GateCollection,
  where: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const result = await repositories.find({
    collection,
    where: where as never,
    limit: 1,
  })
  return (result.docs[0] as Record<string, unknown> | undefined) ?? null
}

/**
 * `null` = the gate is off (settings demo override or no active framework
 * template) and the panel shows no warning; the API stays the final arbiter
 * on submit.
 */
async function hasSignedRaamleping(
  repositories: CoreRepositories,
  userId: string,
): Promise<boolean | null> {
  const template = await findGateDoc(repositories, 'contract-templates', {
    and: [{ type: { equals: 'framework' } }, { active: { equals: true } }],
  })
  if (!template) return null
  const signed = await findGateDoc(repositories, 'contracts', {
    and: [
      { signedBy: { equals: userId } },
      { status: { equals: 'signed' } },
      { template: { equals: template.id } },
    ],
  })
  return signed !== null
}

// ── Header pieces ───────────────────────────────────────────────────────

const STATUS_PILL_MAP: Record<AuctionDossier['status'], PillStatus> = {
  draft: 'draft',
  scheduled: 'scheduled',
  active: 'active',
  ended: 'ended',
  appraised: 'ended',
  contract: 'ended',
  completed: 'ended',
  archived: 'ended',
  unsold: 'ended',
}

function StatusBadge({ auction }: { auction: AuctionDossier }) {
  if (auction.status === 'unsold') {
    return (
      <span className="inline-flex items-center rounded-pill bg-statusEndingSoon/10 px-2 py-0.5 text-xs font-medium text-statusEndingSoon">
        Jäi müümata
      </span>
    )
  }
  return <StatusPill status={STATUS_PILL_MAP[auction.status]} />
}

function QuickAuctionBadge() {
  return (
    <span className="inline-flex items-center rounded-pill bg-primaryLight px-2 py-0.5 text-xs font-medium text-primaryDark">
      Kiiroksjon
    </span>
  )
}

// Demo dark sealed badge with the lock icon (03-lot-detail-sealed.html
// .badge-sealed).
function SealedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-primaryDark px-3 py-0.5 text-bodySm font-semibold text-white">
      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
      Suletud pimepakkumine
    </span>
  )
}

function similarLink(auction: AuctionDossier): string {
  const county = auction.county?.code ?? auction.county?.id
  return county !== undefined && county !== ''
    ? `/?tab=${auction.objectType}&county=${encodeURIComponent(county)}`
    : `/?tab=${auction.objectType}`
}

function EndedPanel({
  auction,
  unsold,
}: {
  auction: AuctionDossier
  unsold: boolean
}) {
  return (
    <section className="flex flex-col gap-sm rounded-card border border-border bg-bgPage p-md shadow-card">
      <h2 className="font-heading text-h3 text-ink">
        {unsold ? 'Oksjon jäi müümata' : 'Oksjon on lõppenud'}
      </h2>
      {!unsold && auction.finalPrice !== null && (
        <p className="text-body text-inkMuted">
          Lõpphind:{' '}
          <span className="font-semibold text-ink">
            {eur(auction.finalPrice)}
          </span>
          {auction.vatIncluded ? ' (sisaldab käibemaksu)' : ''}
        </p>
      )}
      <Link
        href={similarLink(auction)}
        className="text-bodySm font-semibold text-primary hover:text-primaryHover"
      >
        Vaata sarnaseid oksjoneid ›
      </Link>
    </section>
  )
}

// ── Sealed viewer snapshot (task 4.6) ───────────────────────────────────

/**
 * Server-side snapshot for the sealed panel: own sealed bids, the settings
 * revision cap, the opening-ceremony outcome, and identity prefill. Own-bid
 * data only — sealed disclosure to everyone else stays at the bid count.
 */
async function buildSealedViewer(
  repositories: CoreRepositories,
  auth: { userId: string; profileId: string | null },
  auctionId: string,
): Promise<SealedViewerSnapshot> {
  const [profile, systemRepositories, settings] = await Promise.all([
    getActiveProfile(),
    getRepositories(),
    findGateDoc(repositories, 'settings', {}),
  ])

  // Own isikukood is read as system context from the users row, the same
  // owner-scoped disclosure the profile page uses.
  const user = await systemRepositories.findByID({
    collection: 'users',
    id: auth.userId,
  })
  const userRecord = (user ?? {}) as Record<string, unknown>
  const rawIsikukood = userRecord.isikukood
  const isikukood =
    typeof rawIsikukood === 'string' && rawIsikukood.trim() !== ''
      ? rawIsikukood
      : null

  const ownBids = await repositories.find({
    collection: 'bids',
    where: {
      and: [
        { auction: { equals: auctionId } },
        { user: { equals: auth.userId } },
        { type: { equals: 'sealed' } },
      ],
    },
    limit: 100,
  })

  let ownBidCount = 0
  let latestSubmittedAt: string | null = null
  let outcome: SealedViewerSnapshot['outcome'] = null
  for (const doc of ownBids.docs) {
    const bid = doc as Record<string, unknown>
    if (bid.status === 'rejected') continue
    ownBidCount += 1
    if (bid.status === 'won' || bid.status === 'lost') {
      outcome = bid.status
    }
    const createdAt = typeof bid.createdAt === 'string' ? bid.createdAt : null
    if (
      createdAt !== null &&
      (latestSubmittedAt === null || createdAt > latestSubmittedAt)
    ) {
      latestSubmittedAt = createdAt
    }
  }

  const revisionCap =
    typeof settings?.sealedRevisionCap === 'number'
      ? settings.sealedRevisionCap
      : 3

  const profileType: SealedViewerSnapshot['profileType'] =
    profile?.type === 'company' ? 'company' : 'private'
  const displayName =
    profileType === 'company'
      ? (profile?.companyName ?? profile?.displayName ?? null)
      : (profile?.displayName ?? null)

  return {
    profileType,
    displayName,
    isikukood,
    registrikood:
      profileType === 'company' ? (profile?.companyRegCode ?? null) : null,
    revisionCap,
    ownBidCount,
    latestSubmittedAt,
    outcome,
  }
}

/**
 * The caller's own active autobidder row for the auction: the id enables
 * "Uuenda"/"Eemalda" in AutobidderControl and `maxAmount` prefills it.
 * Cancelled (paused) rows count as absent, matching the dossier's
 * `participation.hasAutobidder`.
 */
async function findOwnAutobidder(
  repositories: CoreRepositories,
  userId: string,
  auctionId: string,
): Promise<{ id: string; maxAmount: number } | null> {
  const result = await repositories.find({
    collection: 'autobidders',
    where: {
      and: [
        { user: { equals: userId } },
        { auction: { equals: auctionId } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1,
  })
  const doc = result.docs[0] as Record<string, unknown> | undefined
  if (
    doc === undefined ||
    typeof doc.id !== 'string' ||
    typeof doc.maxAmountCents !== 'number'
  ) {
    return null
  }
  return { id: doc.id, maxAmount: centsToEuros(doc.maxAmountCents) }
}

// ── Page ────────────────────────────────────────────────────────────────

export default async function AuctionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [auth, repositories] = await Promise.all([
    getPortalAuthState(),
    getRepositories(),
  ])
  const viewer =
    auth === null
      ? null
      : {
          userId: auth.userId,
          ...(auth.profileId !== null
            ? { activeProfileId: auth.profileId }
            : {}),
        }

  const auction = await getAuctionDossier(repositories, id, viewer)
  if (!auction) notFound()

  const isSealed = auction.type === 'sealed'
  const typeLabels = OBJECT_TYPE_LABELS[auction.objectType]
  const typeHref = `/?tab=${typeLabels.tab}`

  // Role-shaped bid list (task 4.5); open auctions only — sealed pages keep
  // the count on SealedBidPanel.
  const bidView =
    auction.type === 'open'
      ? await getAuctionBids(repositories, id, viewer)
      : null

  // Sealed panels get a server-built viewer snapshot (own bids, revision
  // cap, outcome, identity prefill); open panels keep the dossier fields.
  const sealedViewer =
    auction.type === 'sealed' && auth !== null
      ? await buildSealedViewer(repositories, auth, auction.id)
      : null

  const images = galleryImages(auction.media, auction.title)
  const files = fileLinks([...auction.files, ...auction.media])
  const description = richTextBlocks(auction.descriptionPublic)
  const secondaryInfo = richTextBlocks(auction.descriptionSecondary)

  const endsAtIso = auction.endsAt
  const endsAt = endsAtIso !== null ? Date.parse(endsAtIso) : Number.NaN
  // Epoch ms anchor for the client countdown's drift correction (design D4).
  const serverNow = Date.now()
  const countdownEndsAt =
    endsAtIso !== null &&
    (auction.status === 'scheduled' || auction.status === 'active') &&
    Number.isFinite(endsAt) &&
    endsAt > Date.now()
      ? endsAtIso
      : null

  const isEndedLike =
    auction.status === 'ended' ||
    auction.status === 'appraised' ||
    auction.status === 'contract' ||
    auction.status === 'completed' ||
    auction.status === 'archived' ||
    auction.status === 'unsold'

  // Open auctions mount the BidPanel for scheduled/active (and, defensively,
  // ended) statuses. Sealed auctions always mount SealedBidPanel: it renders
  // its own scheduled/active/locked/opening-result states.
  const mountBidPanel = !isEndedLike && auction.type === 'open'
  const isBiddingOpen = auction.status === 'active'
  let antiSnipeMinutes: number | null = null
  let allowUnderStart = false
  let hasRaamleping: boolean | null = null
  if (mountBidPanel) {
    const settings = await findGateDoc(repositories, 'settings', {})
    const flags: unknown = settings?.featureFlags
    const gateDisabled =
      typeof flags === 'object' &&
      flags !== null &&
      (flags as Record<string, unknown>).requireFrameworkContract === false
    antiSnipeMinutes =
      typeof settings?.antiSnipeDurationMinutes === 'number'
        ? settings.antiSnipeDurationMinutes
        : null
    // The under-start toggle renders only on active open auctions whose
    // Settings enable alapakkumine; the API re-checks the flag on submit.
    allowUnderStart = isBiddingOpen && settings?.alapakkumineEnabled === true
    if (auth !== null && !gateDisabled) {
      hasRaamleping = await hasSignedRaamleping(repositories, auth.userId)
    }
  }

  // Own autobidder row feeds AutobidderControl's prefill and Eemalda; only
  // the active form state renders the control.
  const ownAutobidder =
    mountBidPanel && isBiddingOpen && auth !== null
      ? await findOwnAutobidder(repositories, auth.userId, auction.id)
      : null

  const rows: DossierRow[] = []
  if (auction.cadastres.length > 0) {
    rows.push({
      label: 'Katastritunnused',
      value: auction.cadastres.join(', '),
      mono: true,
    })
  }
  if (auction.registryNumbers.length > 0) {
    rows.push({
      label: 'Kinnistu registrinumber',
      value: auction.registryNumbers.join(', '),
      mono: true,
    })
  }
  if (auction.county !== null)
    rows.push({ label: 'Maakond', value: auction.county.name })
  if (auction.parish !== null)
    rows.push({ label: 'Vald', value: auction.parish.name })
  if (auction.address !== null)
    rows.push({ label: 'Aadress', value: auction.address })
  if (auction.area !== null)
    rows.push({
      label: 'Pindala',
      value: `${num(auction.area)} ha`,
      mono: true,
    })
  if (auction.volume !== null) {
    rows.push({
      label: 'Raiemaht',
      value: `${num(auction.volume)} m³`,
      mono: true,
    })
  }
  if (auction.species.length > 0) {
    rows.push({
      label: 'Puuliigid',
      value: auction.species.join(', '),
      mono: true,
    })
  }
  if (auction.loggingTypes.length > 0) {
    rows.push({
      label: 'Raieliigid',
      value: auction.loggingTypes.join(', '),
      mono: true,
    })
  }
  if (auction.compartments.length > 0) {
    rows.push({
      label: 'Eraldised',
      value: auction.compartments.join(', '),
      mono: true,
    })
  }
  const notifications = notificationNumbers(auction.forestNotifications)
  if (notifications.length > 0) {
    rows.push({
      label: 'Metsateatise nr',
      value: notifications.join(', '),
      mono: true,
    })
  }
  const loggingDeadline = deadlineValue(auction.deadlines, [
    'loggingDeadline',
    'logging',
    'raie',
  ])
  if (loggingDeadline !== null) {
    rows.push({
      label: 'Raie teostamise tähtaeg',
      value: loggingDeadline,
      mono: true,
    })
  }
  const removalDeadline = deadlineValue(auction.deadlines, [
    'removalDeadline',
    'removal',
  ])
  if (removalDeadline !== null) {
    rows.push({
      label: 'Väljaveo tähtaeg',
      value: removalDeadline,
      mono: true,
    })
  }
  const storageApproval = approvalLabel(auction.deadlines, [
    'storageLocationApproval',
    'storageApproval',
  ])
  if (storageApproval !== null) {
    rows.push({
      label: 'Ladustamiskohtade kooskõlastus',
      value: storageApproval,
    })
  }
  const removalRoads = approvalLabel(auction.deadlines, ['removalRoads'])
  if (removalRoads !== null) {
    rows.push({ label: 'Väljaveoteed', value: removalRoads })
  }
  const rental = rentalLabel(auction.deadlines)
  if (rental !== null) rows.push({ label: 'Üürileping', value: rental })
  if (isSealed) {
    rows.push({ label: 'Oksjoni tüüp', value: 'Suletud pimepakkumine' })
    rows.push({ label: 'Alghind', value: eur(auction.minBid), mono: true })
    const sealedDeadline =
      auction.endsAt !== null ? fmtDeadline(auction.endsAt) : null
    if (sealedDeadline !== null) {
      rows.push({
        label: 'Pakkumiste tähtaeg',
        value: sealedDeadline,
        mono: true,
      })
    }
  } else {
    rows.push({ label: 'Alghind', value: eur(auction.minBid), mono: true })
    if (auction.bidStep !== null) {
      rows.push({
        label: 'Pakkumise samm',
        value: eur(auction.bidStep),
        mono: true,
      })
    }
  }

  const firstCadastre = auction.cadastres[0]
  const katasterHref =
    auction.katasterLink ??
    (auction.cadastres.length === 1 && firstCadastre !== undefined
      ? `https://ky.kataster.ee/?cdr=${encodeURIComponent(firstCadastre)}`
      : 'https://ky.kataster.ee')
  const metsaregisterHref =
    auction.metsaregisterLink ?? 'https://register.metsad.ee'

  const factsLinks = [
    { label: 'Katastrikaart', href: katasterHref },
    { label: 'Metsaregister', href: metsaregisterHref },
  ]

  const locationLine =
    [auction.county?.name, auction.parish?.name, auction.address]
      .filter((part) => part !== undefined && part !== null && part !== '')
      .join(' · ') || 'Asukoht määramata'

  const anchorTabs = [
    { id: 'ulevaade', label: 'Ülevaade' },
    { id: 'asukoht', label: 'Asukoht' },
    { id: 'dokumendid', label: 'Dokumendid' },
    { id: 'pakkumised', label: 'Pakkumised' },
  ]

  const headingClass = 'mb-3.5 font-heading text-h3 text-ink'
  const sectionIntroClass = '-mt-1 mb-4 text-bodySm text-inkMuted'

  return (
    <AuctionStreamProvider>
      {isSealed ? (
        <LotHeadBand
          title={auction.title}
          typeLabel={typeLabels.plural}
          typeHref={typeHref}
          badges={
            <>
              <StatusBadge auction={auction} />
              {auction.isQuickAuction && <QuickAuctionBadge />}
              <SealedBadge />
            </>
          }
          deadline={
            countdownEndsAt !== null
              ? { endsAt: countdownEndsAt, serverNow }
              : null
          }
        />
      ) : (
        <>
          <nav
            aria-label="Jäljerada"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-bodySm"
          >
            <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-1 p-0">
              <li>
                <Link
                  href="/"
                  className="text-inkMuted no-underline transition-colors duration-hover hover:text-primary"
                >
                  Oksjonid
                </Link>
              </li>
              <li aria-hidden="true" className="text-border">
                /
              </li>
              <li>
                <Link
                  href={typeHref}
                  className="text-inkMuted no-underline transition-colors duration-hover hover:text-primary"
                >
                  {typeLabels.plural}
                </Link>
              </li>
              <li aria-hidden="true" className="text-border">
                /
              </li>
              <li aria-current="page" className="font-semibold text-ink">
                {auction.title}
              </li>
            </ol>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <StatusBadge auction={auction} />
              {auction.isQuickAuction && <QuickAuctionBadge />}
            </div>
          </nav>
          <div className="-mx-md mt-sm border-b border-border bg-bgPage px-md md:-mx-lg md:px-lg">
            <AnchorTabs items={anchorTabs} />
          </div>
        </>
      )}

      <div
        className={`grid items-start gap-lg lg:grid-cols-[minmax(0,1fr)_400px] ${
          isSealed ? '' : 'pt-md'
        }`}
      >
        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-lg">
          {isSealed ? (
            <>
              <Gallery images={images} />
              {rows.length > 0 && (
                <FactsCard rows={rows} links={factsLinks} />
              )}
              {auction.packageRows.length > 0 && (
                <section
                  aria-label="Pakett"
                  className="rounded-card border border-border bg-bgPage p-7 shadow-card"
                >
                  <h2 className={headingClass}>Pakett</h2>
                  <PackageSection
                    header={auction.packageHeader}
                    columns={auction.packageColumns}
                    rows={auction.packageRows}
                  />
                </section>
              )}
              {(description.length > 0 || secondaryInfo.length > 0) && (
                <section
                  aria-labelledby="sealed-info-heading"
                  className="rounded-card border border-border bg-bgPage p-7 shadow-card"
                >
                  <h2 id="sealed-info-heading" className={headingClass}>
                    Info
                  </h2>
                  <div className="flex flex-col gap-md">
                    <RichText blocks={description} />
                    <RichText blocks={secondaryInfo} />
                  </div>
                </section>
              )}
              {files.length > 0 && (
                <section
                  aria-labelledby="sealed-docs-heading"
                  className="rounded-card border border-border bg-bgPage p-7 shadow-card"
                >
                  <h2 id="sealed-docs-heading" className={headingClass}>
                    Dokumendid
                  </h2>
                  <DocumentList items={files} variant="plain" />
                </section>
              )}
            </>
          ) : (
            <>
              <section id="ulevaade" aria-label="Ülevaade" className="scroll-mt-24">
                <div className="flex flex-col gap-md">
                  <Gallery images={images} />
                  {description.length > 0 && (
                    <div>
                      <h2 className={headingClass}>
                        Oksjoni info ja erisused
                      </h2>
                      <RichText blocks={description} />
                    </div>
                  )}
                  {secondaryInfo.length > 0 && (
                    <div>
                      <h2 className={headingClass}>Lisainfo</h2>
                      <RichText blocks={secondaryInfo} />
                    </div>
                  )}
                  {rows.length > 0 && (
                    <div>
                      <h2 className={headingClass}>Peamised andmed</h2>
                      <DossierTable rows={rows} />
                    </div>
                  )}
                  {auction.packageRows.length > 0 && (
                    <div>
                      <h2 className={headingClass}>Pakett</h2>
                      <PackageSection
                        header={auction.packageHeader}
                        columns={auction.packageColumns}
                        rows={auction.packageRows}
                      />
                    </div>
                  )}
                </div>
              </section>

              <section id="asukoht" aria-label="Asukoht" className="scroll-mt-24">
                <h2 className={headingClass}>Asukoht ja kaart</h2>
                <p className={sectionIntroClass}>
                  Ligikaudne asukoht kaardil — täpne piiritlus katastrikaardil
                  ja metsaregistris.
                </p>
                {auction.coordinates !== null && (
                  <div className="h-72 overflow-hidden rounded-hero border border-border shadow-card lg:h-96 [&_.map-estonia]:h-full [&_.map-estonia]:min-h-0 [&_.map-estonia__fallback]:h-full [&_.map-estonia__fallback]:min-h-0">
                    <MapEstonia
                      pins={[
                        {
                          lat: auction.coordinates.lat,
                          lng: auction.coordinates.lng,
                          label: auction.title,
                        },
                      ]}
                      center={[
                        auction.coordinates.lat,
                        auction.coordinates.lng,
                      ]}
                      zoom={13}
                    />
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-bodySm text-inkMuted">
                  {auction.coordinates !== null && (
                    <span className="font-mono text-xs text-ink">
                      {`${auction.coordinates.lat.toFixed(4)}° N · ${auction.coordinates.lng.toFixed(4)}° E`}
                    </span>
                  )}
                  <span>{locationLine}</span>
                  <div className="flex flex-wrap gap-2.5 sm:ml-auto">
                    {factsLinks.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-button border border-primary px-3.5 py-1.5 text-bodySm font-semibold text-primary transition-colors duration-hover hover:bg-primaryLight hover:text-primaryHover"
                      >
                        {link.label}
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                </div>
              </section>

              {files.length > 0 && (
                <section
                  id="dokumendid"
                  aria-label="Dokumendid"
                  className="scroll-mt-24"
                >
                  <h2 className={headingClass}>Dokumendid</h2>
                  <p className={sectionIntroClass}>
                    Ametlikud dokumendid. Allalaadimine toimub turvalise,
                    allkirjastatud lingiga.
                  </p>
                  <DocumentList items={files} variant="panel" />
                </section>
              )}

              {bidView !== null && (
                <div id="pakkumised" className="scroll-mt-24">
                  <BidList auctionId={auction.id} initialView={bidView} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Side rail */}
        <aside
          aria-label={isSealed ? 'Pimepakkumine' : 'Pakkumise paneel'}
          className="flex flex-col gap-lg self-start lg:sticky lg:top-6"
        >
          {isSealed ? (
            <SealedBidPanel
              auctionId={auction.id}
              status={auction.status}
              startsAt={auction.startsAt}
              endsAt={auction.endsAt}
              minBid={auction.minBid}
              bidCount={auction.bidCount}
              finalPrice={auction.finalPrice}
              viewer={sealedViewer}
            />
          ) : (
            <>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-inkMuted">
                  {`${typeLabels.singular} · Avatud oksjon`}
                </p>
                <h1 className="break-words font-heading text-h3 font-bold leading-tight text-ink">
                  {auction.title}
                </h1>
                {countdownEndsAt !== null && (
                  <div className="mt-2">
                    <LiveCountdown
                      auctionId={auction.id}
                      endsAt={countdownEndsAt}
                      serverNow={serverNow}
                    />
                  </div>
                )}
              </div>
              {isEndedLike ? (
                <EndedPanel
                  auction={auction}
                  unsold={auction.status === 'unsold'}
                />
              ) : (
                <LiveBidPanel
                  auctionId={auction.id}
                  objectType={auction.objectType}
                  status={auction.status}
                  startsAt={auction.startsAt}
                  endsAt={auction.endsAt}
                  minBid={auction.minBid}
                  bidStep={auction.bidStep}
                  leadingBidAmount={auction.leadingBidAmount}
                  finalPrice={auction.finalPrice}
                  antiSnipeMinutes={antiSnipeMinutes}
                  allowUnderStart={allowUnderStart}
                  bidCount={auction.bidCount}
                  viewer={
                    auth === null
                      ? null
                      : {
                          hasBid: auction.participation?.hasBid ?? false,
                          isLeading: auction.participation?.isLeading ?? false,
                          hasRights: null,
                          hasRaamleping,
                          hasAutobidder:
                            auction.participation?.hasAutobidder ?? false,
                          hasPendingUnderStart:
                            auction.participation?.hasPendingUnderStart ?? false,
                          autobidderId: ownAutobidder?.id ?? null,
                          autobidderMaxAmount: ownAutobidder?.maxAmount ?? null,
                        }
                  }
                />
              )}
            </>
          )}
          <SellerContact
            specialist={auction.contact.specialist}
            aliasEmail={auction.contact.aliasEmail}
          />
        </aside>
      </div>
    </AuctionStreamProvider>
  )
}

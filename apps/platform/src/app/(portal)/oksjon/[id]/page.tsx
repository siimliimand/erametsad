import { Countdown, DocumentLink, MapEstonia, StatusPill } from '@eametsad/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BidList } from './_components/BidList'
import { BidPanel } from './_components/BidPanel'
import {
  DossierTable,
  PackageSection,
  type DossierRow,
} from './_components/DossierTable'
import { Gallery, type GalleryImage } from './_components/Gallery'
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
  return value.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' })
}

function num(value: number): string {
  return value.toLocaleString('et-EE', { maximumFractionDigits: 2 })
}

function fmtDate(value: string): string | null {
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  return new Date(time).toLocaleDateString('et-EE', { dateStyle: 'long' })
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

// ── Rich text (Payload Lexical JSON or plain text; never HTML) ──────────

function richTextParagraphs(value: string | null): string[] {
  if (value === null || value.trim() === '') return []
  try {
    const parsed: unknown = JSON.parse(value)
    const paragraphs: string[] = []
    collectText(parsed, paragraphs)
    const cleaned = paragraphs
      .map((text) => text.trim())
      .filter((text) => text !== '')
    return cleaned.length > 0 ? cleaned : [value.trim()]
  } catch {
    return value
      .split(/\n+/)
      .map((text) => text.trim())
      .filter((text) => text !== '')
  }
}

function collectText(node: unknown, out: string[]): void {
  if (typeof node === 'string') {
    out.push(node)
    return
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out)
    return
  }
  if (typeof node !== 'object' || node === null) return
  const record = node as Record<string, unknown>
  if (Array.isArray(record.children)) collectText(record.children, out)
  if (typeof record.text === 'string') out.push(record.text)
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
  const description = richTextParagraphs(auction.descriptionPublic)

  const endsAtIso = auction.endsAt
  const endsAt = endsAtIso !== null ? Date.parse(endsAtIso) : Number.NaN
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
    })
  }
  if (auction.registryNumbers.length > 0) {
    rows.push({
      label: 'Kinnistu registrinumber',
      value: auction.registryNumbers.join(', '),
    })
  }
  if (auction.county !== null)
    rows.push({ label: 'Maakond', value: auction.county.name })
  if (auction.parish !== null)
    rows.push({ label: 'Vald', value: auction.parish.name })
  if (auction.address !== null)
    rows.push({ label: 'Aadress', value: auction.address })
  if (auction.area !== null)
    rows.push({ label: 'Pindala', value: `${num(auction.area)} ha` })
  if (auction.volume !== null) {
    rows.push({ label: 'Raiemaht', value: `${num(auction.volume)} m³` })
  }
  if (auction.species.length > 0) {
    rows.push({ label: 'Puuliigid', value: auction.species.join(', ') })
  }
  if (auction.loggingTypes.length > 0) {
    rows.push({ label: 'Raieliigid', value: auction.loggingTypes.join(', ') })
  }
  if (auction.compartments.length > 0) {
    rows.push({ label: 'Eraldised', value: auction.compartments.join(', ') })
  }
  const notifications = notificationNumbers(auction.forestNotifications)
  if (notifications.length > 0) {
    rows.push({ label: 'Metsateatise nr', value: notifications.join(', ') })
  }
  const loggingDeadline = deadlineValue(auction.deadlines, [
    'loggingDeadline',
    'logging',
    'raie',
  ])
  if (loggingDeadline !== null) {
    rows.push({ label: 'Raie teostamise tähtaeg', value: loggingDeadline })
  }
  const removalDeadline = deadlineValue(auction.deadlines, [
    'removalDeadline',
    'removal',
  ])
  if (removalDeadline !== null) {
    rows.push({ label: 'Väljaveo tähtaeg', value: removalDeadline })
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
  if (auction.type !== 'sealed') {
    rows.push({ label: 'Alghind', value: eur(auction.minBid) })
    if (auction.bidStep !== null) {
      rows.push({ label: 'Pakkumise samm', value: eur(auction.bidStep) })
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

  return (
    <AuctionStreamProvider>
      <div className="flex flex-col gap-lg">
        <div className="flex flex-col gap-xs">
          <Link
            href="/"
            className="text-bodySm text-inkMuted hover:text-primary"
          >
            ‹ Kõik oksjonid
          </Link>
          <div className="flex flex-wrap items-center gap-sm">
            <h1 className="font-heading text-h2 text-ink">{auction.title}</h1>
            <StatusBadge auction={auction} />
            {auction.isQuickAuction && (
              <span className="inline-flex items-center rounded-pill bg-primaryLight px-2 py-0.5 text-xs font-medium text-primaryDark">
                Kiiroksjon
              </span>
            )}
            {countdownEndsAt !== null && (
              <Countdown endsAt={countdownEndsAt} className="ml-auto" />
            )}
          </div>
        </div>

        <div className="grid gap-lg lg:grid-cols-3">
          <div className="flex flex-col gap-lg lg:col-span-2">
            <Gallery images={images} />

            <section className="flex flex-col gap-sm rounded-card border border-border bg-bgPage p-md shadow-card">
              <h2 className="font-heading text-h4 text-ink">
                Asukoht ja kaart
              </h2>
              <p className="text-bodySm text-inkMuted">
                {[auction.county?.name, auction.parish?.name, auction.address]
                  .filter(
                    (part) =>
                      part !== undefined && part !== null && part !== '',
                  )
                  .join(' · ') || 'Asukoht määramata'}
              </p>
              {auction.coordinates !== null && (
                <MapEstonia
                  pins={[
                    {
                      lat: auction.coordinates.lat,
                      lng: auction.coordinates.lng,
                      label: auction.title,
                    },
                  ]}
                  center={[auction.coordinates.lat, auction.coordinates.lng]}
                  zoom={13}
                  className="h-72 w-full rounded-card"
                />
              )}
              <div className="flex flex-wrap gap-sm">
                <a
                  href={katasterHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bodySm font-semibold text-primary hover:text-primaryHover"
                >
                  Kataster ↗
                </a>
                <a
                  href={metsaregisterHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bodySm font-semibold text-primary hover:text-primaryHover"
                >
                  Metsaregister ↗
                </a>
              </div>
            </section>

            {rows.length > 0 && (
              <section className="flex flex-col gap-sm">
                <h2 className="font-heading text-h4 text-ink">Andmetabel</h2>
                <DossierTable rows={rows} />
              </section>
            )}

            {auction.packageRows.length > 0 && (
              <section className="flex flex-col gap-sm">
                <h2 className="font-heading text-h4 text-ink">Pakett</h2>
                <PackageSection
                  header={auction.packageHeader}
                  columns={auction.packageColumns}
                  rows={auction.packageRows}
                />
              </section>
            )}

            {description.length > 0 && (
              <section className="flex flex-col gap-sm rounded-card border border-border bg-bgPage p-md shadow-card">
                <h2 className="font-heading text-h4 text-ink">
                  Oksjoni info ja erisused
                </h2>
                <div className="flex flex-col gap-xs">
                  {description.map((paragraph, index) => (
                    <p key={index} className="text-body text-ink">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            )}

            {files.length > 0 && (
              <section className="flex flex-col gap-sm">
                <h2 className="font-heading text-h4 text-ink">Failid</h2>
                <div className="grid gap-sm sm:grid-cols-2">
                  {files.map((file) => (
                    <DocumentLink
                      key={file.href}
                      title={file.title}
                      href={file.href}
                      {...(file.size !== undefined
                        ? { fileSize: file.size }
                        : {})}
                      {...(file.format !== undefined
                        ? { format: file.format }
                        : {})}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="flex flex-col gap-lg">
            {auction.type === 'sealed' ? (
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
            ) : isEndedLike ? (
              <EndedPanel
                auction={auction}
                unsold={auction.status === 'unsold'}
              />
            ) : (
              <BidPanel
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
                viewer={
                  auth === null
                    ? null
                    : {
                        hasBid: auction.participation?.hasBid ?? false,
                        isLeading: auction.participation?.isLeading ?? false,
                        hasRights: null,
                        hasRaamleping,
                        hasAutobidder: auction.participation?.hasAutobidder ?? false,
                        autobidderId: ownAutobidder?.id ?? null,
                        autobidderMaxAmount: ownAutobidder?.maxAmount ?? null,
                      }
                }
              />
            )}
            {bidView !== null && (
              <BidList auctionId={auction.id} initialView={bidView} />
            )}
            <SellerContact
              specialist={auction.contact.specialist}
              aliasEmail={auction.contact.aliasEmail}
            />
          </div>
        </div>
      </div>
    </AuctionStreamProvider>
  )
}

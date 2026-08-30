import { Countdown, DocumentLink, MapEstonia, StatusPill } from '@eametsad/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { DossierTable, PackageSection, type DossierRow } from './_components/DossierTable'
import { Gallery, type GalleryImage } from './_components/Gallery'
import { SellerContact } from './_components/SellerContact'

import { getPortalAuthState } from '@/app/(portal)/_lib/session'
import { getAuctionDossier, type AuctionDossier } from '@/lib/auction/queries'
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
    return { id: value, url: null, filename: null, mimeType: null, filesize: null }
  }
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id : null
  const url = typeof record.url === 'string' && record.url !== '' ? record.url : null
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
  if (entry.url && (entry.url.startsWith('/') || entry.url.startsWith('http'))) {
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
  if (bytes < 1024 * 1024) return `${String(Math.max(1, Math.round(bytes / 1024)))} kB`
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
    .filter((item): item is { entry: MediaEntry; src: string } => item.src !== null)
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
    const cleaned = paragraphs.map((text) => text.trim()).filter((text) => text !== '')
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

function deadlineValue(deadlines: unknown, keys: readonly string[]): string | null {
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

function approvalLabel(deadlines: unknown, keys: readonly string[]): string | null {
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
  const until = deadlineValue(deadlines, ['rentalAgreementDeadline', 'rentalDeadline'])
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
          if (typeof value === 'string' && value.trim() !== '') return value.trim()
        }
      }
      return null
    })
    .filter((value): value is string => value !== null)
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

function EndedPanel({ auction, unsold }: { auction: AuctionDossier; unsold: boolean }) {
  return (
    <section className="flex flex-col gap-sm rounded-card border border-border bg-bgPage p-md shadow-card">
      <h2 className="font-heading text-h3 text-ink">
        {unsold ? 'Oksjon jäi müümata' : 'Oksjon on lõppenud'}
      </h2>
      {!unsold && auction.finalPrice !== null && (
        <p className="text-body text-inkMuted">
          Lõpphind: <span className="font-semibold text-ink">{eur(auction.finalPrice)}</span>
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

function BidSlot({ auction }: { auction: AuctionDossier }) {
  // Tasks 4.2-4.4 mount the open-auction BidPanel here; the sealed variant
  // replaces it in its own task. Nothing interactive until then.
  return (
    <section
      id="bid-panel"
      data-bid-panel-placeholder
      className="flex flex-col gap-2xs rounded-card border border-dashed border-border bg-bgPage p-md"
    >
      <h2 className="font-heading text-h4 text-ink">Pakkumine</h2>
      <p className="text-bodySm text-inkMuted">
        {auction.type === 'sealed'
          ? auction.bidCount !== null
            ? `Pakkumisi: ${String(auction.bidCount)}`
            : 'Suletud pakkumine.'
          : 'Pakkumisvorm lisatakse varsti.'}
      </p>
    </section>
  )
}

// ── Page ────────────────────────────────────────────────────────────────

export default async function AuctionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [auth, repositories] = await Promise.all([getPortalAuthState(), getRepositories()])
  const viewer =
    auth === null
      ? null
      : {
          userId: auth.userId,
          ...(auth.profileId !== null ? { activeProfileId: auth.profileId } : {}),
        }

  const auction = await getAuctionDossier(repositories, id, viewer)
  if (!auction) notFound()

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

  const rows: DossierRow[] = []
  if (auction.cadastres.length > 0) {
    rows.push({ label: 'Katastritunnused', value: auction.cadastres.join(', ') })
  }
  if (auction.registryNumbers.length > 0) {
    rows.push({ label: 'Kinnistu registrinumber', value: auction.registryNumbers.join(', ') })
  }
  if (auction.county !== null) rows.push({ label: 'Maakond', value: auction.county.name })
  if (auction.parish !== null) rows.push({ label: 'Vald', value: auction.parish.name })
  if (auction.address !== null) rows.push({ label: 'Aadress', value: auction.address })
  if (auction.area !== null) rows.push({ label: 'Pindala', value: `${num(auction.area)} ha` })
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
  const loggingDeadline = deadlineValue(auction.deadlines, ['loggingDeadline', 'logging', 'raie'])
  if (loggingDeadline !== null) {
    rows.push({ label: 'Raie teostamise tähtaeg', value: loggingDeadline })
  }
  const removalDeadline = deadlineValue(auction.deadlines, ['removalDeadline', 'removal'])
  if (removalDeadline !== null) {
    rows.push({ label: 'Väljaveo tähtaeg', value: removalDeadline })
  }
  const storageApproval = approvalLabel(auction.deadlines, ['storageLocationApproval', 'storageApproval'])
  if (storageApproval !== null) {
    rows.push({ label: 'Ladustamiskohtade kooskõlastus', value: storageApproval })
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
  const metsaregisterHref = auction.metsaregisterLink ?? 'https://register.metsad.ee'

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col gap-xs">
        <Link href="/" className="text-bodySm text-inkMuted hover:text-primary">
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
          {countdownEndsAt !== null && <Countdown endsAt={countdownEndsAt} className="ml-auto" />}
        </div>
      </div>

      <div className="grid gap-lg lg:grid-cols-3">
        <div className="flex flex-col gap-lg lg:col-span-2">
          <Gallery images={images} />

          <section className="flex flex-col gap-sm rounded-card border border-border bg-bgPage p-md shadow-card">
            <h2 className="font-heading text-h4 text-ink">Asukoht ja kaart</h2>
            <p className="text-bodySm text-inkMuted">
              {[auction.county?.name, auction.parish?.name, auction.address]
                .filter((part) => part !== undefined && part !== null && part !== '')
                .join(' · ') || 'Asukoht määramata'}
            </p>
            {auction.coordinates !== null && (
              <MapEstonia
                pins={[{ lat: auction.coordinates.lat, lng: auction.coordinates.lng, label: auction.title }]}
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
              <h2 className="font-heading text-h4 text-ink">Oksjoni info ja erisused</h2>
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
                    {...(file.size !== undefined ? { fileSize: file.size } : {})}
                    {...(file.format !== undefined ? { format: file.format } : {})}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-lg">
          {isEndedLike ? (
            <EndedPanel auction={auction} unsold={auction.status === 'unsold'} />
          ) : (
            <BidSlot auction={auction} />
          )}
          <SellerContact
            specialist={auction.contact.specialist}
            aliasEmail={auction.contact.aliasEmail}
          />
        </div>
      </div>
    </div>
  )
}

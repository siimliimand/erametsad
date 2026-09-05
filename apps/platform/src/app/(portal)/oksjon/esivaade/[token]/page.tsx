import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { Gallery, type GalleryImage } from '../../[id]/_components/Gallery'
import { RichText, richTextBlocks } from '../../[id]/_components/RichText'
import { verifyGuestPreviewToken } from '../_lib/preview-token'

import { centsToEuros } from '@/lib/data/repositories/money'
import { getRepositories } from '@/lib/data/runtime'

/**
 * Guest preview of an unpublished draft lot (docs 03 step 7, task 2.5). The
 * token in the URL is stateless: an HMAC over the auction id plus a 24-hour
 * expiry, so no preview-token storage exists. Renders the draft read-only
 * on the portal layout; published lots redirect to the public page.
 */

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Oksjoni eelvaade' }

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

function packageRowList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === 'object' && entry !== null,
      )
    : []
}

function eurosOr(value: unknown, fallback: string): string {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed.toLocaleString('et-EE', { maximumFractionDigits: 2 })
}

function cellText(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
}

function euroAmount(cents: unknown): string | null {
  return typeof cents === 'number' && Number.isSafeInteger(cents) && cents >= 0
    ? centsToEuros(cents).toLocaleString('et-EE', { maximumFractionDigits: 2 })
    : null
}

function formatTallinn(iso: string | null): string | null {
  if (iso === null || Number.isNaN(Date.parse(iso))) return null
  return new Date(iso).toLocaleString('et-EE', { timeZone: 'Europe/Tallinn' })
}

function expiredAtLabel(expiresAtMs: number): string {
  return new Date(expiresAtMs).toLocaleString('et-EE', { timeZone: 'Europe/Tallinn' })
}

interface DraftFact {
  label: string
  value: string
}

function buildFacts(auction: Record<string, unknown>): DraftFact[] {
  const deadlines = asRecord(auction.deadlines)
  const coordinates = asRecord(auction.coordinates)
  const facts: DraftFact[] = []

  const startsAt = formatTallinn(typeof auction.startsAt === 'string' ? auction.startsAt : null)
  const endsAt = formatTallinn(typeof auction.endsAt === 'string' ? auction.endsAt : null)
  if (startsAt !== null) facts.push({ label: 'Algus', value: startsAt })
  if (endsAt !== null) facts.push({ label: 'Lõpp', value: endsAt })

  const minBid = euroAmount(auction.minBidCents)
  if (minBid !== null) facts.push({ label: 'Alghind', value: `${minBid} €` })
  const bidStep = euroAmount(auction.bidStepCents)
  if (bidStep !== null) facts.push({ label: 'Pakkumise samm', value: `${bidStep} €` })

  const countyId = typeof auction.countyId === 'string' ? auction.countyId : ''
  const parishId = typeof auction.parishId === 'string' ? auction.parishId : ''
  if (countyId !== '' || parishId !== '') {
    facts.push({ label: 'Maakond / vald', value: [countyId, parishId].filter(Boolean).join(' / ') })
  }
  const address = typeof auction.address === 'string' ? auction.address : ''
  if (address !== '') facts.push({ label: 'Aadress', value: address })
  const lat = coordinates.lat
  const lng = coordinates.lng
  if (typeof lat === 'number' && typeof lng === 'number') {
    facts.push({ label: 'Koordinaadid', value: `${String(lat)}, ${String(lng)}` })
  }

  const cadastres = stringArray(auction.cadastres)
  if (cadastres.length > 0) facts.push({ label: 'Katastritunnused', value: cadastres.join(', ') })
  const registryNumbers = stringArray(auction.registryNumbers)
  if (registryNumbers.length > 0) {
    facts.push({ label: 'Kinnistu registrinumbrid', value: registryNumbers.join(', ') })
  }
  const species = stringArray(auction.species)
  if (species.length > 0) facts.push({ label: 'Puuliigid', value: species.join(', ') })
  const loggingTypes = stringArray(auction.loggingTypes)
  if (loggingTypes.length > 0) facts.push({ label: 'Raieliigid', value: loggingTypes.join(', ') })
  const compartments = stringArray(auction.compartments)
  if (compartments.length > 0) facts.push({ label: 'Eraldised', value: compartments.join(', ') })

  const area = deadlines.areaHa
  if (typeof area === 'number' && area > 0) {
    facts.push({ label: 'Pindala', value: `${eurosOr(area, '')} ha` })
  }
  const volume = deadlines.volumeM3
  if (typeof volume === 'number' && volume > 0) {
    facts.push({ label: 'Raiemaht', value: `${eurosOr(volume, '')} m³` })
  }
  const propertyCount = deadlines.propertyCount
  if (typeof propertyCount === 'number' && propertyCount > 0) {
    facts.push({ label: 'Kinnistute arv', value: String(propertyCount) })
  }
  for (const [key, label] of [
    ['loggingDeadline', 'Raie teostamise tähtaeg'],
    ['removalDeadline', 'Väljaveo tähtaeg'],
    ['leaseDeadline', 'Rendi tähtaeg'],
  ] as const) {
    const deadline = deadlines[key]
    if (typeof deadline === 'string' && deadline !== '') {
      facts.push({ label, value: deadline })
    }
  }
  return facts
}

export default async function GuestPreviewPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const verification = await verifyGuestPreviewToken(token)
  if (!verification.ok) {
    if (verification.reason === 'expired') {
      return (
        <div className="mx-auto flex max-w-xl flex-col gap-sm rounded-card border border-border bg-bgPage p-lg text-center">
          <h1 className="font-heading text-h3 text-ink">Eelvaade on aegunud</h1>
          <p className="text-body text-inkMuted">
            See eelvaade aegus {expiredAtLabel(verification.expiresAtMs)}. Küsi müüjalt uus link.
          </p>
          <Link href="/" className="text-bodySm font-semibold text-primary hover:text-primaryHover">
            ‹ Kõik oksjonid
          </Link>
        </div>
      )
    }
    notFound()
  }

  const repositories = await getRepositories()
  const auction = await repositories.findByID({
    collection: 'auctions',
    id: verification.auctionId,
  })
  if (!auction) notFound()
  // The preview exists for unpublished lots; anything public belongs to the
  // regular portal page (bid panels, bid list, live countdown).
  if (auction.status !== 'draft' && auction.status !== 'scheduled') {
    redirect(`/oksjon/${auction.id}`)
  }

  const record = auction as unknown as Record<string, unknown>
  const images: GalleryImage[] = stringArrayOrMedia(record.media)
  const description = richTextBlocks(typeof record.descriptionPublic === 'string' ? record.descriptionPublic : null)
  const secondaryInfo = richTextBlocks(
    typeof record.descriptionSecondary === 'string' ? record.descriptionSecondary : null,
  )
  const facts = buildFacts(record)
  const rows = packageRowList(record.packageRows)

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col gap-xs">
        <Link href="/" className="text-bodySm text-inkMuted hover:text-primary">
          ‹ Kõik oksjonid
        </Link>
        <div className="flex flex-wrap items-center gap-sm">
          <h1 className="font-heading text-h2 text-ink">{auction.title}</h1>
          <span className="inline-flex items-center rounded-pill bg-bgMist px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-inkMuted">
            Eelvaade · mustand
          </span>
        </div>
        <p className="text-bodySm text-inkMuted">
          Selle eelvaade kehtib kuni {expiredAtLabel(verification.expiresAtMs)}.
        </p>
      </div>

      <div className="grid gap-lg lg:grid-cols-3">
        <div className="flex flex-col gap-lg lg:col-span-2">
          <Gallery images={images} />

          {facts.length > 0 ? (
            <section className="flex flex-col gap-sm">
              <h2 className="font-heading text-h4 text-ink">Andmetabel</h2>
              <dl className="grid grid-cols-1 gap-xs sm:grid-cols-2">
                {facts.map((fact) => (
                  <div key={fact.label} className="rounded-card border border-border bg-bgPage p-sm">
                    <dt className="text-label font-semibold text-ink">{fact.label}</dt>
                    <dd className="text-body text-inkMuted">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {rows.length > 0 ? (
            <section className="flex flex-col gap-sm">
              <h2 className="font-heading text-h4 text-ink">Pakett</h2>
              {typeof record.packageHeader === 'string' && record.packageHeader !== '' ? (
                <p className="text-body text-inkMuted">{record.packageHeader}</p>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-bodySm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th scope="col" className="px-2 py-1 font-semibold text-inkMuted">Katastritunnus</th>
                      <th scope="col" className="px-2 py-1 font-semibold text-inkMuted">Kinnistu nr</th>
                      <th scope="col" className="px-2 py-1 font-semibold text-inkMuted">Maakond</th>
                      <th scope="col" className="px-2 py-1 font-semibold text-inkMuted">Pindala ha</th>
                      <th scope="col" className="px-2 py-1 font-semibold text-inkMuted">Alghind €</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={String(index)} className="border-b border-border">
                        <td className="px-2 py-1 text-ink">{cellText(row.cadastre)}</td>
                        <td className="px-2 py-1 text-ink">{cellText(row.registryNumber)}</td>
                        <td className="px-2 py-1 text-ink">{cellText(row.county)}</td>
                        <td className="px-2 py-1 text-ink">{eurosOr(row.areaHa, '—')}</td>
                        <td className="px-2 py-1 text-ink">{eurosOr(row.minBidEur, '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {description.length > 0 ? (
            <section className="flex flex-col gap-sm rounded-card border border-border bg-bgPage p-md shadow-card">
              <h2 className="font-heading text-h4 text-ink">Oksjoni info ja erisused</h2>
              <RichText blocks={description} />
            </section>
          ) : null}

          {secondaryInfo.length > 0 ? (
            <section className="flex flex-col gap-sm rounded-card border border-border bg-bgPage p-md shadow-card">
              <h2 className="font-heading text-h4 text-ink">Lisainfo</h2>
              <RichText blocks={secondaryInfo} />
            </section>
          ) : null}
        </div>

        <div className="flex flex-col gap-sm">
          <section className="flex flex-col gap-xs rounded-card border border-border bg-bgPage p-md shadow-card">
            <h2 className="font-heading text-h5 text-ink">Eelvaade</h2>
            <p className="text-bodySm text-inkMuted">
              See on salvestamata mustand. Pakkumised ei ole võimalikud enne oksjoni
              avaldamist.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

/** Media rows arrive as {url, alt} records (write path of the wizard). */
function stringArrayOrMedia(value: unknown): GalleryImage[] {
  if (!Array.isArray(value)) return []
  const images: GalleryImage[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    if (typeof record.url !== 'string' || record.url === '') continue
    images.push({ src: record.url, alt: typeof record.alt === 'string' ? record.alt : '' })
  }
  return images
}

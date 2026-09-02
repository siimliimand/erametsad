import { LeadForm, SpecialistCard } from '@erametsad/ui'
import Link from 'next/link'

import { CompanyCard } from '../_components/CompanyCard'
import { buildMetadata } from '../_lib/seo'
import { MapWithFallback } from './_components/MapWithFallback'

import { getRepositories } from '@/lib/data/runtime'

// See kkk/page.tsx: force-dynamic keeps DB-less CI builds green; D7's
// build-time D1 seeding moves this to ISR later.
export const dynamic = 'force-dynamic'

export const metadata = buildMetadata({
  title: 'Kontakt',
  description:
    'Erametsad OÜ kontaktandmed, metsaspetsialistide otsenumbrid ja päringuvorm. Kirjuta või helista — vastame 1 tööpäeva jooksul.',
  path: '/kontakt',
})

// Draft office marker from the design doc (17-kontakt.md block 5): Settings
// holds no coordinates yet, so the pin sits on central Tallinn until the CMS
// gains a location field.
const OFFICE_COORDS: [number, number] = [59.437, 24.754]
const OFFICE_ZOOM = 11

// Settings has no org phone column, so the "otse numbrid" block from the
// design doc (17-kontakt.md block 2) is fed with the seeded specialists'
// direct numbers instead of placeholder strings.
interface DirectNumberRow {
  label: string
  phone: string
}

export default async function KontaktPage() {
  const repos = await getRepositories()
  const [specialistsResult, settingsResult] = await Promise.all([
    repos.find({ collection: 'specialists', sort: 'name', limit: 3 }),
    repos.find({ collection: 'settings', limit: 1 }),
  ])
  const specialists = specialistsResult.docs
  const settings = settingsResult.docs[0]

  const directNumbers = [
    { label: 'Müük ja konsultatsioon', phone: specialists[0]?.phone ?? undefined },
    { label: 'Üldine ja tehniline abi', phone: specialists[1]?.phone ?? undefined },
  ].filter((row): row is DirectNumberRow => row.phone !== undefined)

  const photoIds = [
    ...new Set(
      specialists
        .map((specialist) => specialist.photoId)
        .filter((photoId): photoId is string => photoId !== null),
    ),
  ]
  const imageUrlByPhotoId = new Map<string, string>()
  if (photoIds.length > 0) {
    const mediaResult = await repos.find({
      collection: 'media',
      where: { id: { in: photoIds }, url: { exists: true } },
      pagination: false,
    })
    for (const mediaAsset of mediaResult.docs) {
      if (mediaAsset.url) {
        imageUrlByPhotoId.set(mediaAsset.id, mediaAsset.url)
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-container-xl px-md py-xl lg:px-lg">
      <h1 className="font-heading text-h1 text-ink">Võta ühendust</h1>
      <p className="mt-sm max-w-container-sm font-body text-body text-inkMuted">
        Kirjuta või helista — vastame 1 tööpäeva jooksul.
      </p>

      <div className="mt-xl grid gap-xl lg:grid-cols-12">
        {/* Mobile puts the form right after the hero (17-kontakt.md). */}
        <section
          id="kontaktvorm"
          className="order-1 scroll-mt-28 rounded-card bg-bgMist p-lg lg:order-2 lg:col-span-7 lg:scroll-mt-20"
        >
          <h2 className="font-heading text-h3 text-ink">Saada päring</h2>
          <div className="mt-md">
            <LeadForm slug="kontakt" />
          </div>
          <p className="mt-md font-body text-bodySm text-inkMuted">
            Press ja koostöö:{' '}
            <a
              href="mailto:press@erametsad.ee"
              className="font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
            >
              press@erametsad.ee
            </a>
          </p>
        </section>

        <div className="order-2 flex flex-col gap-lg lg:order-1 lg:col-span-5">
          <CompanyCard
            orgName={settings?.orgName ?? undefined}
            orgRegCode={settings?.orgRegCode ?? undefined}
            orgAddress={settings?.orgAddress ?? undefined}
          />

          {directNumbers.length > 0 && (
            <section>
              <h2 className="font-heading text-h4 text-ink">Otse numbrid</h2>
              <ul className="mt-sm flex flex-col gap-xs">
                {directNumbers.map((row) => (
                  <li
                    key={row.label}
                    className="flex flex-col gap-0.5 sm:flex-row sm:gap-md"
                  >
                    <span className="shrink-0 font-body text-label text-inkMuted sm:w-56 sm:pt-0.5">
                      {row.label}
                    </span>
                    <a
                      href={`tel:${row.phone.replace(/\s+/g, '')}`}
                      className="font-mono font-body text-bodySm text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
                    >
                      {row.phone}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {specialists.length > 0 && (
            <section>
              <h2 className="font-heading text-h4 text-ink">Spetsialistid</h2>
              <p className="mt-xs font-body text-bodySm text-inkMuted">
                Ei tea, kelle poole pöörduda? Helista üldnumbrile — suuname õige
                inimese juurde.
              </p>
              <ul className="mt-md flex flex-col gap-md sm:grid sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {specialists.map((specialist) => {
                  const image = specialist.photoId
                    ? imageUrlByPhotoId.get(specialist.photoId)
                    : undefined
                  return (
                    <li key={specialist.id}>
                      {/* Spread keeps absent optionals out of the props under
                          exactOptionalPropertyTypes (same as the roster page). */}
                      <SpecialistCard
                        mini
                        name={specialist.name}
                        role={specialist.role ?? ''}
                        {...(specialist.phone ? { phone: specialist.phone } : {})}
                        {...(specialist.email ? { email: specialist.email } : {})}
                        {...(image ? { image } : {})}
                      />
                    </li>
                  )
                })}
              </ul>
              <Link
                href="/meist/metsaspetsialistid"
                className="mt-md inline-flex h-12 items-center justify-center rounded-button border border-primary bg-transparent px-6 font-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primary-light"
              >
                Vaata kõiki spetsialiste
              </Link>
            </section>
          )}
        </div>
      </div>

      <section className="mt-xl">
        <MapWithFallback
          center={OFFICE_COORDS}
          zoom={OFFICE_ZOOM}
          {...(settings?.orgName ? { pinLabel: settings.orgName } : {})}
          address={settings?.orgAddress ?? undefined}
        />
        <div className="mt-sm flex flex-wrap gap-md">
          <a
            href="https://www.google.com/maps?q=59.4370,24.7536"
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-bodySm font-semibold text-primary underline transition-colors duration-hover ease-hover hover:text-primaryHover"
          >
            Vaata Google Mapsis
          </a>
          <a
            href="https://kaart.maaamet.ee/maaamet/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-bodySm font-semibold text-primary underline transition-colors duration-hover ease-hover hover:text-primaryHover"
          >
            Ava Maa-ameti kaardil
          </a>
        </div>
      </section>
    </main>
  )
}

import Link from 'next/link'

import { CompanyCard } from '../_components/CompanyCard'
import { buildMetadata } from '../_lib/seo'

import { getRepositories } from '@/lib/data/runtime'

// D7 asks for ISR (revalidate = 3600) on content pages, but CI and deploy
// builds run `next build` without a seeded D1, so prerendering against the
// CMS would fail the build or bake empty pages. Request-time rendering is
// the repo-wide convention for DB-backed pages; drop `force-dynamic` and
// add generateStaticParams once build-time D1 seeding exists.
export const dynamic = 'force-dynamic'

export const metadata = buildMetadata({
  title: 'Meist',
  description:
    'Erametsad OÜ – kogemus, metsaspetsialistid ja läbipaistvad metsaoksjonid. Registriandmed, missioon ja kontaktid ühes kohas.',
  path: '/meist',
})

// Draft copy from the design doc (docs/design/marketing/13-meist.md, block 4):
// the settings schema has no CEO quote field yet, so the block ships with the
// documented draft instead of staying hidden until CMS work lands.
const CEO_QUOTE =
  'Mets on pikaajaline investeering — meie ülesanne on tagada, et selle võõrandamisel langetaks otsuseid teave, mitte ärevus.'

export default async function MeistPage() {
  const repos = await getRepositories()
  const settingsResult = await repos.find({ collection: 'settings', limit: 1 })
  const settings = settingsResult.docs[0]

  return (
    <div className="mx-auto w-full max-w-container-xl px-md py-lg sm:py-xl lg:px-lg">
      <h1 className="font-heading text-h1 text-ink">
        Sul on metsa majandamist puudutav küsimus?
      </h1>
      <p className="mt-sm max-w-container-sm font-body text-body text-inkMuted">
        Vastame metsa, hinna ja oksjoni kohta — tasuta.
      </p>

      <section className="mt-lg max-w-container-sm sm:mt-xl">
        <CompanyCard
          orgName={settings?.orgName ?? 'Erametsad OÜ'}
          orgRegCode={settings?.orgRegCode ?? undefined}
          vatNumber={settings?.orgVatCode ?? undefined}
          orgAddress={settings?.orgAddress ?? undefined}
          phone={settings?.supportPhone ?? undefined}
          email={settings?.supportEmail ?? undefined}
        />
      </section>

      <section className="mt-lg max-w-container-sm sm:mt-xl">
        <blockquote className="rounded-card bg-bgMist p-md shadow-card sm:p-lg">
          <p className="font-heading text-base font-medium leading-relaxed text-ink sm:text-lg sm:font-semibold md:text-xl">
            <span aria-hidden="true" className="text-primary mr-0.5">
              &bdquo;
            </span>
            {CEO_QUOTE}
            <span aria-hidden="true" className="text-primary ml-0.5">
              &ldquo;
            </span>
          </p>
          <cite className="mt-sm block font-body text-bodySm not-italic text-inkMuted sm:mt-md">
            [Juhi nimi], tegevjuht
          </cite>
        </blockquote>
      </section>

      <p className="mt-lg sm:mt-xl">
        <Link
          href="/meist/metsaspetsialistid"
          className="inline-flex h-12 w-full items-center justify-center rounded-button border border-primary bg-transparent px-6 font-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primary-light sm:w-auto"
        >
          Vaata kõiki spetsialiste
        </Link>
      </p>
    </div>
  )
}

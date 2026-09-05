import { Card } from '@erametsad/ui'
import { PenLine, Scale, Send } from 'lucide-react'

import { buildBreadcrumbJsonLd, buildItemListJsonLd, toJsonLdScript } from '../_lib/jsonld'
import { buildMetadata } from '../_lib/seo'
import { SERVICES, ServiceCards, type ServiceCounts } from './_components/ServiceCards'

import type { CoreRepositories } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'

// Spec 09: content caching via ISR. Partner counts degrade to zero when a
// build runs without a seeded D1 (cards render disabled), so prerendering
// is safe and runtime revalidation picks up the live counts.
export const revalidate = 3600

export const metadata = buildMetadata({
  title: 'Teenuste päringud — kava, raie, istutamine',
  description:
    'Esita päring metsamajanduskava, hooldusraie või istutamise kohta. Päring läheb kõigile registreeritud teenusepakkujatele — pakkumised tavaliselt 7 päeva jooksul.',
  path: '/paringud',
})

const HOW_IT_WORKS_STEPS = [
  {
    title: 'Täida ja saada päring',
    icon: PenLine,
    points: ['Päringu täitmine võtab umbes 1 minuti', 'Täitmine on tasuta ja mitte siduv'],
  },
  {
    title: 'Päring läheb kõigile pakkujatele',
    icon: Send,
    points: [
      'Päring edastatakse kõigile registreeritud teenusepakkujatele',
      'Iga edastus on jälgitav edastuslogis',
    ],
  },
  {
    title: 'Võrdle pakkumisi ja vali',
    icon: Scale,
    points: [
      'Pakkumised laekuvad tavaliselt 7 päeva jooksul',
      'Otsus jääb täielikult sinu kätte',
      'Erametsad on vahendaja — leping sõlmid otse firmaga',
    ],
  },
] as const

// Zero counts degrade the service to its disabled card state, so a failed
// read must yield the all-zero map, never a throw.
async function loadPartnerCounts(repos: CoreRepositories | null): Promise<ServiceCounts> {
  const counts: ServiceCounts = { kava: 0, hooldusraie: 0, istutamine: 0 }
  if (!repos) return counts
  try {
    const { docs } = await repos.find({
      collection: 'partners',
      where: { active: { equals: true } },
      pagination: false,
    })
    for (const partner of docs) {
      if (!Array.isArray(partner.serviceTypes)) continue
      for (const serviceType of partner.serviceTypes) {
        if (
          serviceType === 'kava' ||
          serviceType === 'hooldusraie' ||
          serviceType === 'istutamine'
        ) {
          counts[serviceType] += 1
        }
      }
    }
  } catch {
    // Missing D1 binding or partners table: keep zero counts.
  }
  return counts
}

const itemListJsonLd = buildItemListJsonLd(
  SERVICES.map(({ title }) => ({ name: title })),
)
const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: 'Avaleht', path: '/' },
  { name: 'Teenuste päringud', path: '/paringud' },
])

const sectionHeadingClass = 'font-heading text-h2 text-ink'

export default async function ParingudPage() {
  let repos: CoreRepositories | null = null
  try {
    repos = await getRepositories()
  } catch {
    // No D1 binding: partner counts fall back to zero (cards disabled).
  }
  const counts = await loadPartnerCounts(repos)
  const visibleCounts = SERVICES.filter(({ type }) => counts[type] > 0)

  return (
    <main className="pb-2xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(breadcrumbJsonLd) }}
      />

      {/* 1. Hero — photo overlay treatment matches avaleht; the photo asset
          itself lands with the Phase 0 design decision. */}
      <section className="bg-[linear-gradient(90deg,rgba(22,56,42,0.92),rgba(22,56,42,0.55))]">
        <div className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
          <h1 className="font-heading text-h1 text-inkInverse">Teenuste päringud</h1>
          <p className="mt-md max-w-container-sm text-body text-white/90">
            Täida päring ja saada see ühe klikiga kõigile registreeritud
            teenusepakkujatele. Nemad võtavad sinuga ühendust ja esitavad
            pakkumise — tavaliselt 7 päeva jooksul.
          </p>
          <p className="mt-lg inline-block border-b-4 border-accent pb-1 font-heading text-h4 font-semibold text-white">
            Pakkujad vastavad 7 päeva jooksul
          </p>
        </div>
      </section>

      {/* 2. Service cards */}
      <section className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
        <h2 className={sectionHeadingClass}>Vali sobiv teenus</h2>
        <p className="mt-2xs text-body text-inkMuted">
          Päring jõuab korraga kõigile selle teenuse pakkujatele.
        </p>
        <div className="mt-md">
          <ServiceCards counts={counts} />
        </div>
      </section>

      {/* 3. How it works */}
      <section className="bg-bgMist">
        <div className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
          <h2 className={sectionHeadingClass}>Kuidas see toimib?</h2>
          <ol className="mt-md grid gap-lg md:grid-cols-3">
            {HOW_IT_WORKS_STEPS.map(({ title, icon: Icon, points }, index) => (
              <li key={title}>
                <Card
                  hover={false}
                  className="h-full"
                  content={
                    <>
                      <div className="flex items-center gap-sm">
                        <span className="font-heading text-count text-primary">
                          {index + 1}
                        </span>
                        <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                      </div>
                      <h3 className="mt-xs font-heading text-h4 text-ink">{title}</h3>
                      <ul className="mt-sm list-disc space-y-2 pl-5 text-bodySm text-inkMuted marker:text-primary">
                        {points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </>
                  }
                />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. Partner info — anonymized counts only; the /liitu link stays
          hidden until Phase 5 (spec 09). */}
      <section className="mx-auto max-w-container-xl px-md pt-xl md:px-lg">
        <div className="rounded-card bg-primaryLight p-lg">
          <h2 className="font-heading text-h3 text-ink">
            Päringu edastamine on omanikule tasuta
          </h2>
          <p className="mt-xs max-w-container-sm text-body text-ink">
            Erametsad ei müü metsateenust ise — päring jõuab kõigile selle
            teenuse registreeritud teenusepakkujatele ja pakkumised laekuvad
            otse sinule. Pakkujate arv uueneb pidevalt.
          </p>
          {visibleCounts.length > 0 && (
            <ul className="mt-md flex flex-wrap gap-xs">
              {visibleCounts.map(({ type, title }) => {
                const count = counts[type]
                return (
                  <li
                    key={type}
                    className="inline-flex items-center gap-2 rounded-pill border border-border bg-bgPage px-4 py-1.5 text-bodySm text-inkMuted"
                  >
                    {title} ·{' '}
                    <b className="font-mono font-medium text-primary">
                      {count} {count === 1 ? 'pakkuja' : 'pakkujat'}
                    </b>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  )
}

import Link from 'next/link'

import { marketingUrl } from '../../_lib/base-url'
import { buildBreadcrumbJsonLd, buildServiceJsonLd, toJsonLdScript } from '../../_lib/jsonld'
import { buildMetadata } from '../../_lib/seo'
import { PromiseBand } from '../_components/PromiseBand'
import { RequestTabs } from '../_components/RequestTabs'
import { ServiceRequestForm } from '../_components/ServiceRequestForm'

// Static shell: the page renders no server-side data, and the shared
// layout's contact band degrades to empty without a D1 binding.
export const revalidate = 3600

export const metadata = buildMetadata({
  title: 'Hooldusraie päring — hooldus- ja valgusraie',
  description:
    'Esita päring hooldusraie või valgusraie kohta. Päring läheb kõigile registreeritud teenusepakkujatele — pakkumised tavaliselt 7 päeva jooksul.',
  path: '/paringud/hooldusraie',
})

const serviceJsonLd = buildServiceJsonLd({
  name: 'Hooldus- ja valgusraie',
  description:
    'Hooldusraie ja valgusraie erametsas. Päring edastatakse registreeritud teenusepakkujatele, kes vastavad tavaliselt 7 päeva jooksul.',
  url: marketingUrl('/paringud/hooldusraie'),
})

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: 'Avaleht', path: '/' },
  { name: 'Teenuste päringud', path: '/paringud' },
  { name: 'Hooldusraie', path: '/paringud/hooldusraie' },
])

const contentLinkClass = 'font-semibold text-primary underline hover:no-underline'

export default function HooldusraiePage() {
  return (
    <main className="pb-2xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(serviceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(breadcrumbJsonLd) }}
      />

      {/* 1. Tabs + H1 */}
      <section className="mx-auto max-w-container-xl px-md pt-md md:px-lg">
        <RequestTabs />
        <h1 className="mt-md font-heading text-h1 text-ink">Hooldusraiete päring</h1>
        <p className="mt-sm max-w-container-sm text-body text-inkMuted">
          Kui sinu noorem mets vajab hooldus- või valgusraiet, esita päring koos kava
          failiga. Partnerfirmad vastavad 7 päeva jooksul.
        </p>
      </section>

      {/* 2. Form first in DOM (mobile: form right after H1); content column
          moves left of the form on desktop (spec 11 wireframe, 7+5 cols). */}
      <section className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
        <div className="grid gap-xl md:grid-cols-12">
          <div className="md:order-first md:col-span-7">
            <h2 className="font-heading text-h2 text-ink">Mis on hooldusraie?</h2>
            <p className="mt-sm text-body text-inkMuted">
              Hooldusraiega hooldame noort metsa: langetame võsa ja liigpuud, et
              järelekasvavatel puudel oleks ruumi, valgust ja toitaineid. Hooldatud
              puistu on kasvujõulisem ja tervem.
            </p>
            <div className="mt-md grid gap-md sm:grid-cols-2">
              <div className="rounded-card border border-border bg-bgPage p-md">
                <h3 className="font-heading text-h4 text-ink">Kultuuride hooldamine</h3>
                <p className="mt-xs text-bodySm text-inkMuted">
                  Noore metsa hooldamine: võsa raie ja liigtaimestiku eemaldamine, et
                  kultuur kasvaks ühtlaselt ja jääks tervislikuks.
                </p>
              </div>
              <div className="rounded-card border border-border bg-bgPage p-md">
                <h3 className="font-heading text-h4 text-ink">Valgusraie</h3>
                <p className="mt-xs text-bodySm text-inkMuted">
                  Langetame ebaõnnestunud või halvasti kasvavad puud, et jäävatel
                  puudel oleks kasvuruumi.
                </p>
              </div>
            </div>
            <p className="mt-md text-body text-inkMuted">
              Erinevalt lageraiest mets hooldusraigega ei lõpe — maha võetakse ainult
              osa puudest ja puistu jääb kasvama. Loa ja raieliikide kohta loe{' '}
              <Link href="/artiklid/lageraie" className={contentLinkClass}>
                lageraie artiklist
              </Link>{' '}
              või{' '}
              <Link href="/kkk/raie" className={contentLinkClass}>
                KKK vastustest
              </Link>
              .
            </p>

            <h2 className="mt-xl font-heading text-h2 text-ink">Mis ajakava oodata?</h2>
            <p className="mt-sm text-body text-inkMuted">
              Päring edastatakse kõigile registreeritud teenusepakkujatele. Nad võtavad
              sinuga ühendust ja esitavad pakkumise tavaliselt 7 päeva jooksul. Päringu
              esitamine on tasuta ega sidu sind — otsus jääb täielikult sinu kätte.
            </p>
          </div>

          <div className="md:col-span-5">
            <ServiceRequestForm
              type="hooldusraie"
              formName="hooldusraie-1"
              pageSlug="/paringud/hooldusraie"
              labels={{
                county: 'Raielangi maakond',
                cadastres: 'Raielangi katastritunnus',
                provisions: 'Eraldis/eraldised',
                provisionsHint: 'nt 5, 7 — eraldise numbrid kava järgi',
                submit: 'Saada',
              }}
            />
          </div>
        </div>
      </section>

      {/* 3. Promise band */}
      <PromiseBand />
    </main>
  )
}

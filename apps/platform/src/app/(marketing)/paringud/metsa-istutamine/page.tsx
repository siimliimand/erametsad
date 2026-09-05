import Link from 'next/link'

import { marketingUrl } from '../../_lib/base-url'
import {
  buildBreadcrumbJsonLd,
  buildServiceJsonLd,
  toJsonLdScript,
} from '../../_lib/jsonld'
import { buildMetadata } from '../../_lib/seo'
import { PromiseBand } from '../_components/PromiseBand'
import { RequestTabs } from '../_components/RequestTabs'
import { ServiceRequestForm } from '../_components/ServiceRequestForm'

// Static shell: the page renders no server-side data, and the shared
// layout's contact band degrades to empty without a D1 binding.
export const revalidate = 3600

export const metadata = buildMetadata({
  title: 'Metsa istutamise päring — istutamine, istikud',
  description:
    'Esita päring metsa istutamise, istikute või maapinna ettevalmistuse kohta ja täida taastamiskohustus. Päring läheb kõigile pakkujatele — vastus tavaliselt 7 päeva jooksul.',
  path: '/paringud/metsa-istutamine',
})

// Spec 12: field names follow the page draft copy instead of the kit defaults.
const FORM_LABELS = {
  cadastres: 'Katastritunnus',
  provisions: 'Eraldis/eraldised',
  servicesLegend: 'Soovitud teenused',
  submit: 'Saada',
} as const

const serviceJsonLd = buildServiceJsonLd({
  name: 'Metsa istutamise päring',
  description:
    'Metsa istutamine, istikute valik ja maapinna ettevalmistus — päring edastatakse registreeritud teenusepakkujatele.',
  url: marketingUrl('/paringud/metsa-istutamine'),
})

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: 'Avaleht', path: '/' },
  { name: 'Teenuste päringud', path: '/paringud' },
  { name: 'Metsa istutamise päring', path: '/paringud/metsa-istutamine' },
])

const h2Class = 'font-heading text-h2 text-ink'
const contentTextClass = 'mt-md text-body text-inkMuted'

export default function MetsaIstutaminePage() {
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

      <div className="mx-auto max-w-container-xl px-md py-lg md:px-lg">
        <RequestTabs />

        <h1 className="mt-lg font-heading text-h1 text-ink">
          Metsa istutamise päring
        </h1>
        <p className="mt-md max-w-container-sm text-body text-inkMuted">
          Vali vajalikud teenuseosad ja esita päring — see jõuab korraga kõigile
          registreeritud istutamisteenuse pakkujatele.
        </p>

        {/* Spec 12 mobile order: form right after the H1, content below. */}
        <div className="mt-xl grid grid-cols-12 gap-gutter">
          <div className="order-2 col-span-12 space-y-xl lg:order-1 lg:col-span-7">
            <section>
              <h2 className={h2Class}>Millal mets uuesti istutada?</h2>
              <p className={contentTextClass}>
                Pärast raie tekib seadusest tulenev taastamiskohustus: raiele
                ala tuleb tavaliselt istutada kolme aasta jooksul. Rohkem
                taastamisnõuetest loe{' '}
                <Link
                  href="/kkk"
                  className="font-semibold text-primary underline hover:text-primary-hover"
                >
                  raie KKK-st
                </Link>
                .
              </p>
              <p className="mt-md border-l-4 border-accent bg-bgMist p-md text-bodySm text-inkMuted">
                Täpne tähtaeg sõltub raieliigist ja metsateatisega tehtud
                otsusest.
              </p>
            </section>

            <section>
              <h2 className={h2Class}>Mis hinnapäring sisaldab?</h2>
              <p className={contentTextClass}>
                Pakkujad hindavad töö kas osaliselt või tervikuna — vali üks või
                mitu teenuseosa:
              </p>
              <ul className="mt-md list-disc space-y-2 pl-6 text-body text-inkMuted marker:text-primary">
                <li>Maapinna ettevalmistus — külvikorrastus ja võsarõive</li>
                <li>Istikute valik — puuliik, päritolu ja kogus</li>
                <li>Istutamistöö ise</li>
                <li>
                  Hooldus järgnevatel aastatel —{' '}
                  <Link
                    href="/paringud/hooldusraie"
                    className="font-semibold text-primary underline hover:text-primary-hover"
                  >
                    esita hooldusraie päring
                  </Link>
                </li>
              </ul>
            </section>
          </div>

          <div className="order-1 col-span-12 lg:order-2 lg:col-span-5">
            <ServiceRequestForm
              type="istutamine"
              formName="metsa-istutamine-1"
              pageSlug="/paringud/metsa-istutamine"
              labels={FORM_LABELS}
              commentHint="nt pindala hektarites"
            />
          </div>
        </div>
      </div>

      <PromiseBand />
    </main>
  )
}

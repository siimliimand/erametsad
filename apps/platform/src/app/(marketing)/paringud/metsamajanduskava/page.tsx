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
  title: 'Metsamajanduskava koostamise päring',
  description:
    'Esita päring metsamajanduskava koostamiseks. Kava on alus raieloadele ja toetustele — pakkujad võtavad sinuga ühendust 7 päeva jooksul.',
  path: '/paringud/metsamajanduskava',
})

// Spec 10: FAQ links point at KKK categories seeded with the FAQ phase;
// slugs follow the existing ASCII convention (müük -> muuk).
const FAQ_LINKS = [
  { href: '/kkk/metsaandmed', label: 'KKK: metsaandmed' },
  { href: '/kkk/muuk', label: 'KKK: metsa müük' },
] as const

const faqLinkClass =
  'font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover motion-reduce:transition-none'

const serviceJsonLd = buildServiceJsonLd({
  name: 'Metsamajanduskava koostamine',
  description:
    'Metsamajanduskava koostamise päring erametsaomanikele. Päring edastatakse teenusepakkujatele, kes võtavad ühendust 7 päeva jooksul.',
  url: marketingUrl('/paringud/metsamajanduskava'),
})

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: 'Avaleht', path: '/' },
  { name: 'Teenuste päringud', path: '/paringud' },
  { name: 'Metsamajanduskava', path: '/paringud/metsamajanduskava' },
])

const sectionHeadingClass = 'font-heading text-h2 text-ink'

export default function MetsamajanduskavaPage() {
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

      <div className="mx-auto max-w-container-xl px-md pt-lg md:px-lg">
        <RequestTabs />
        <h1 className="mt-lg font-heading text-h1 text-ink">
          Metsamajanduskava koostamise päring
        </h1>
      </div>

      {/* Spec 10: 7-col content, 5-col form; on mobile the form comes
          straight after the H1 (conversion first, content below). */}
      <div className="mx-auto mt-xl grid max-w-container-xl gap-xl px-md md:px-lg lg:grid-cols-12">
        <div className="order-2 flex flex-col gap-lg lg:order-1 lg:col-span-7">
          <section>
            <h2 className={sectionHeadingClass}>Mis on metsamajanduskava?</h2>
            <p className="mt-sm max-w-container-sm text-body text-inkMuted">
              Metsamajanduskava on kuni 10 aastaks koostatud tegevuskava, mis
              kirjeldab metsa raieliike ja mahusid. Kava on vajalik raieloa
              taolisteks toiminguteks ning metsatoetuste taotlemiseks.
            </p>
            <p className="mt-sm text-body text-inkMuted">
              Loe lisaks{' '}
              <Link href={FAQ_LINKS[0].href} className={faqLinkClass}>
                metsaandmete KKK-st
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className={sectionHeadingClass}>Mis ajakava oodata?</h2>
            <p className="mt-sm max-w-container-sm text-body text-inkMuted">
              Pärast päringu esitamist võtavad pakkujad sinuga ühendust kuni 7
              päeva jooksul. Kava koostamine võtab umbes 2–6 nädalat, olenevalt
              pakkujast.
            </p>
          </section>
        </div>

        <section
          aria-label="Metsamajanduskava koostamise päringu vorm"
          className="order-1 lg:order-2 lg:col-span-5"
        >
          <ServiceRequestForm
            type="kava"
            formName="metsamajanduskava-1"
            pageSlug="/paringud/metsamajanduskava"
            commentHint="nt metsa suurus, erijärgud"
          />
        </section>
      </div>

      <div className="mt-xl">
        <PromiseBand message="Pakkujad vastavad 7 päeva jooksul. Vorm on tasuta ega kohusta sind.">
          {FAQ_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className={faqLinkClass}>
              {label}
            </Link>
          ))}
        </PromiseBand>
      </div>
    </main>
  )
}

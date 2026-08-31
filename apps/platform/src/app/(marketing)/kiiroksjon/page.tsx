import { LeadForm } from '@eametsad/ui'
import {
  Check,
  FileSignature,
  Lock,
  Phone,
  ShieldCheck,
  Timer,
} from 'lucide-react'
import Link from 'next/link'

import { marketingUrl } from '../_lib/base-url'
import {
  buildBreadcrumbJsonLd,
  buildServiceJsonLd,
  toJsonLdScript,
} from '../_lib/jsonld'
import { buildMetadata } from '../_lib/seo'
import { ProcessSteps, type ProcessStep } from './_components/ProcessSteps'

// D7 asks for ISR (revalidate = 3600), but CI and deploy builds run
// `next build` without a seeded D1, and the shared marketing layout reads
// the CMS for the header, footer, and contact band — prerendering would
// start wrangler's remote-binding proxy and fail without an API token.
// Drop `force-dynamic` (and make the layout reads build-safe) once
// build-time D1 seeding exists.
export const dynamic = 'force-dynamic'

export const metadata = buildMetadata({
  title: 'Kiiroksjon — metsa müük 48 tunniga',
  description:
    'Kiiroksjon: 48 tunniga reaalsed pakkumised sinu metsale. Salajane piirhind, alghind alates 1 € ja garanteeritud varupakkumine — ilma eelkuludeta.',
  path: '/kiiroksjon',
})

// Draft copy from docs/design/marketing/07-kiiroksjon.md until the Page block
// builder lands in the CMS.
const PROCESS_STEPS: ProcessStep[] = [
  {
    title: 'Võta ühendust',
    description:
      'Võta meiega ühendust kõne või vormi teel. Spetsialist hindab metsa põhiandmete põhjal.',
    icon: Phone,
  },
  {
    title: 'Sõlmime salajase piirhinna',
    description:
      'Sinu ja Eametsadi vahel kokkulepitud minimaalne aktsepteeritav hind, mis jääb ostjatele nähtamatuks.',
    icon: Lock,
  },
  {
    title: '48 tundi pakkumisi, alates 1 €',
    description:
      'Oksjon avaldatakse portaalis. Madal alghind tõmbab maksimaalselt pakkujaid.',
    icon: Timer,
  },
  {
    title: 'Notariaalne tehe',
    description:
      'Kui piirhind on ületatud, tehakse tehing notariaalselt. Teenustasu on 3% + km lõpphinnast.',
    icon: FileSignature,
  },
  {
    title: 'Garanteeritud varupakkumine',
    description:
      'Kui pakkumisi piirhinnani ei jõua, teeb Eametsad OÜ ise ostupakkumise. Varupakkumine on kohustuslik tagatis.',
    icon: ShieldCheck,
    emphasized: true,
  },
]

const BENEFITS = [
  'Alustamine tasuta',
  'Ei ole eelkulud',
  'Kiirus — nädala jooksul raha juures',
  'Ostjad eelkontrollitud',
  'Läbipaistev protsess portaalis',
  'Varupakkumine tagatud',
]

const SUITABILITY_CONDITIONS = [
  'Mets on müügivalmis (kava/teatis olemas või võimalik)',
  'Soovid kindlat tähtaega',
  'Hind kiiremini kui maksimum',
  // Volume cap is an open question in the design doc (07, "Open questions"):
  // the client must confirm the limit before this placeholder goes live.
  'Müüdav maht kuni ~X m³',
]

const LEAD_FORM_POINTS = [
  'Vastame samal päeval',
  'Oksjon algab 24h jooksul',
  'Eelhindamine tasuta',
]

const SERVICE_JSON_LD = buildServiceJsonLd({
  name: 'Kiiroksjon — metsa müük 48 tunniga',
  url: marketingUrl('/kiiroksjon'),
})

const BREADCRUMB_JSON_LD = buildBreadcrumbJsonLd([
  { name: 'Avaleht', path: '/' },
  { name: 'Kiiroksjon', path: '/kiiroksjon' },
])

const btnCtaClass =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-button bg-cta px-6 font-label font-semibold text-ink transition-all duration-hover ease-hover hover:bg-cta-hover motion-reduce:transition-none md:w-auto'
const h2Class = 'font-heading text-h2 text-ink'

export default function KiiroksjonPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(SERVICE_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(BREADCRUMB_JSON_LD) }}
      />

      <section className="bg-primaryDark text-inkInverse">
        <div className="mx-auto max-w-container-xl px-md py-2xl text-center md:px-lg">
          {/* The badge alone carries no information (design doc 07,
              accessibility): the H1 repeats "48 tunniga" for screen readers. */}
          <div
            aria-hidden="true"
            className="font-heading text-6xl font-extrabold leading-none tracking-tight text-cta md:text-7xl"
          >
            48 H
          </div>
          <h1 className="mx-auto mt-md max-w-container-sm font-heading text-h1 text-inkInverse">
            48 tunniga reaalsed pakkumised sinu metsale
          </h1>
          <p className="mx-auto mt-sm max-w-container-sm text-body text-inkInverse">
            Kiire, turvaline ja ilma eelkuludeta.
          </p>
          <div className="mt-lg">
            <a href="#kontaktvorm" className={btnCtaClass}>
              Alusta — jäta kontakt
            </a>
          </div>
        </div>
      </section>

      <section
        id="kontaktvorm"
        className="scroll-mt-28 bg-bgMist lg:scroll-mt-20"
      >
        <div className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
          <div className="grid grid-cols-12 items-center gap-gutter">
            <div className="col-span-12 lg:col-span-5">
              <h2 className="font-heading text-h3 text-ink">
                Soovid 48 tunniga pakkumised oma metsale?
              </h2>
              <ul className="mt-md space-y-xs">
                {LEAD_FORM_POINTS.map((point) => (
                  <li
                    key={point}
                    className="flex items-center gap-sm text-body text-inkMuted"
                  >
                    <Check
                      className="h-4 w-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-span-12 lg:col-span-7">
              <LeadForm slug="kiiroksjon" />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
        <section>
          <h2 className={h2Class}>Kuidas kiiroksjon toimib?</h2>
          <div className="mt-md">
            <ProcessSteps steps={PROCESS_STEPS} />
          </div>
        </section>

        <section className="mt-xl">
          <h2 className={h2Class}>
            Miks kiiroksjon on metsaomanikule hea lahendus?
          </h2>
          <ul className="mt-md grid gap-xs sm:grid-cols-2 sm:gap-gutter">
            {BENEFITS.map((benefit) => (
              <li
                key={benefit}
                className="flex items-center gap-sm text-body text-ink"
              >
                <Check
                  className="h-4 w-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
                {benefit}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="bg-bgMist">
        <div className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
          <h2 className={h2Class}>Kiiroksjon sobib sulle, kui:</h2>
          <ul className="mt-md max-w-container-sm space-y-xs">
            {SUITABILITY_CONDITIONS.map((condition) => (
              <li
                key={condition}
                className="flex items-center gap-sm text-body text-ink"
              >
                <Check
                  className="h-4 w-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
                {condition}
              </li>
            ))}
          </ul>
          <p className="mt-md max-w-container-sm text-body text-inkMuted">
            Kui kiiroksjon ei sobi, vaata{' '}
            <Link
              href="/teenused/raieoiguse-muuk"
              className="font-semibold text-primary underline underline-offset-2"
            >
              raieõiguse müüki oksjonil
            </Link>
            : klassikaline oksjon annab tavaliselt kõrgema hinna.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
        <section className="grid grid-cols-12 items-center gap-gutter">
          <div className="col-span-12 lg:col-span-5">
            <h2 className="font-heading text-h3 text-ink">
              Räägime täna läbi
            </h2>
            <p className="mt-md text-body text-inkMuted">
              Helista{' '}
              <a
                href="tel:+3726000000"
                className="font-semibold text-primary underline underline-offset-2"
              >
                +372 6000 000
              </a>{' '}
              või jäta kontakt — vastame samal päeval.
            </p>
          </div>
          <div className="col-span-12 lg:col-span-7">
            <LeadForm slug="kiiroksjon" />
          </div>
        </section>
      </div>
    </>
  )
}

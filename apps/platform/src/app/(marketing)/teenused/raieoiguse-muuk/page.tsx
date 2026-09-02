import { LeadForm } from '@erametsad/ui'
import {
  Check,
  Coins,
  History,
  Landmark,
  ShieldCheck,
  Wallet,
} from 'lucide-react'

import { FeeCards, type FeeCardItem } from '../../_components/FeeCards'
import {
  ProcessAccordion,
  type ProcessStepGroup,
} from '../../_components/ProcessAccordion'
import {
  buildBreadcrumbJsonLd,
  buildServiceJsonLd,
  toJsonLdScript,
} from '../../_lib/jsonld'
import { buildMetadata } from '../../_lib/seo'

import { PORTAL_HOSTNAME } from '@/lib/routing/host-areas'

// D7 asks for ISR (revalidate = 3600), but CI and deploy builds run
// `next build` without a seeded D1, and the shared marketing layout reads
// the CMS for the header, footer, and contact band — prerendering would
// start wrangler's remote-binding proxy and fail without an API token.
// Drop `force-dynamic` (and make the layout reads build-safe) once
// build-time D1 seeding exists.
export const dynamic = 'force-dynamic'

export const metadata = buildMetadata({
  title: 'Raieõiguse müük oksjonil',
  description:
    'Müü raieõigus oksjonil — ostjate konkurents toob välja metsa tegeliku turuväärtuse. Tasuta hindamine, kontrollitud ostjad ja 3% teenustasu ainult eduka müügi korral.',
  path: '/teenused/raieoiguse-muuk',
})

// Draft copy from docs/design/marketing/02-teenused-raieoiguse-muuk.md until
// the Page block builder lands in the CMS. Portal CTA paths follow the design
// doc; the host comes from routing/host-areas.ts (prototype host today).
const PORTAL_RAIE_URL = `https://${PORTAL_HOSTNAME}/raie`
const PORTAL_KINNISTUD_URL = `https://${PORTAL_HOSTNAME}/kinnistud`

const PROCESS_GROUPS: ProcessStepGroup[] = [
  {
    id: 'eeltöö',
    title: 'Eeltöö',
    steps: [
      {
        title: 'Vaatame sinu metsa üle',
        description: [
          'Metsaspetsialist külastab sinu metsa tasuta ja kontrollib üle olemasoleva takseeriandmestiku.',
          'Konsultatsioon ja metsa ülevaatus on alati tasuta.',
        ],
      },
      {
        title: 'Paneme paika alghinna',
        description: [
          'Alghinna kujunemisel vaatame puuliike, mahtu, väljavedu ja hetke turuolukorda.',
          'Saad enne oksjonit teada, milline hind on sinu metsa jaoks realistlik.',
        ],
      },
      {
        title: 'Valmistame dokumendid',
        description: [
          'Valmistame ette vajalikud dokumendid: metsamajanduskava, metsateatis ja teeme lepingule eelkontrolli.',
          'Kõik paberid on valmis juba enne oksjoni algust.',
        ],
      },
    ],
  },
  {
    id: 'oksjon',
    title: 'Oksjon',
    steps: [
      {
        title: 'Avalikustame oksjoni',
        description: [
          'Oksjon avalikustatakse meie portaalis koos fotode, kaardi ja takseerandmetega.',
          'Kogu materjal on ostjatele vabalt nähtav, et pakkumised oleksid teadlikud.',
        ],
      },
      {
        title: 'Teavitame ostjate võrgustikku',
        description: [
          'Teavitame uuest oksjonist oma kontrollitud ostjate võrgustikku e-posti ja SMS-iga.',
          'Nii jõuab sinu raieõigus potentsiaalsete ostjateni juba esimestel päevadel.',
        ],
      },
      {
        title: 'Pakkumised konkureerivad',
        description: [
          'Toimub klassikaline tõusev oksjon: ostjad pakuvad fikseeritud sammuga üksteise vastu.',
          'Vajadusel saab kasutada autonoomset pakkumist, mis teeb pakkumisi kuni seatud piirini. Kehtivast pakkumisest madalamaid pakkumisi ei arvestata.',
        ],
      },
    ],
  },
  {
    id: 'tulemus',
    title: 'Tulemus',
    steps: [
      {
        title: 'Kinnitame tulemuse',
        description: [
          'Oksjoni lõppedes saadame sulle võiduteatise ja kinnitame müügitulemuse.',
          'Teenustasu on 3% käibemaksuga võiduhinnast ja see tasutakse ainult eduka müügi korral.',
        ],
      },
      {
        title: 'Sõlmime lepingu',
        description: [
          'Sõlmime oksjonilepingu, kus on kirjas makse- ja raietingimused.',
          'Mõlemad pooled teavad täpselt, millal makse laekub ja millal tohib raiuda.',
        ],
      },
      {
        title: 'Jälgime tööde õigsust',
        description: [
          'Jälgime, et raie- ja väljaveotähtajad peavad kinni lepingust.',
          'Erametsad vastutab protsessi korrektsuse eest kuni tööde lõpuni.',
        ],
      },
    ],
  },
]

const FEE_CARDS: FeeCardItem[] = [
  {
    icon: Coins,
    title: 'Mis see maksab?',
    highlight: '3% + km',
    body: [
      'Teenustasu on 3% käibemaksuga lõpphinnast.',
      'Kui oksjon jääb müümata, ei maksa sa midagi.',
      'Korduskatseid ei ole piiratud.',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Meie vastutus',
    body: [
      'Vastutame korraldatavate tööde ja müügiprotsessi õigsuse eest.',
      'Müüja ei pea kohale tulema.',
    ],
  },
]

const BUYER_CHECKS = [
  {
    icon: Landmark,
    title: 'Äriregistri kontroll',
    text: 'Iga ostja taust kontrollitakse läbi äriregistri.',
  },
  {
    icon: Wallet,
    title: 'Maksevõime',
    text: 'Nõuame iga ostjalt tehinguks piisavat maksevõimet.',
  },
  {
    icon: History,
    title: 'Tehingute ajalugu',
    text: 'Vaatame üle ostja varasemad tehingud.',
  },
]

const LEAD_FORM_BENEFITS = [
  'Tasuta hindamine',
  'Tasu ainult eduka tehingu korral',
  'Hallatud kogu protsess',
]

const SERVICE_JSON_LD = buildServiceJsonLd({
  name: 'Raieõiguse müük oksjonil',
})

const BREADCRUMB_JSON_LD = buildBreadcrumbJsonLd([
  { name: 'Teenused', path: '/teenused' },
  { name: 'Raieõiguse müük oksjonil', path: '/teenused/raieoiguse-muuk' },
])

const btnPrimaryClass =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-button bg-primary px-6 font-label font-semibold text-inkInverse transition-all duration-hover ease-hover hover:bg-primary-hover motion-reduce:transition-none md:w-auto'
const btnOutlineClass =
  'inline-flex h-12 w-full items-center justify-center rounded-button border border-primary bg-transparent px-6 font-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primary-light motion-reduce:transition-none md:w-auto'
const h2Class = 'font-heading text-h2 text-ink'

// Live buyer counts come from GET /api/v1/statistics once a server-side data
// helper lands on this static page; until then the design doc's documented
// fallback copy renders (doc 02, States).
const BUYER_COUNT_FALLBACK = 'Üle 200 kontrollitud raieõiguse ostjat'

export default function RaieoiguseMuukPage() {
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

      <section className="bg-bgMist">
        <div className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
          <h1 className="max-w-container-sm font-heading text-h1 text-ink">
            Raieõiguse müük oksjonil
          </h1>
          <p className="mt-md max-w-container-sm text-body text-inkMuted">
            Raieõiguse oksjonil müük tekitab ostjate vahel konkurentsi ja tagab
            saagi tegeliku turuväärtuse.
          </p>
          <div className="mt-md flex flex-col gap-xs md:flex-row">
            <a
              href={PORTAL_RAIE_URL}
              target="_blank"
              rel="noopener"
              className={btnPrimaryClass}
            >
              Tutvu raieõiguste oksjonitega
            </a>
            <a
              href={PORTAL_KINNISTUD_URL}
              target="_blank"
              rel="noopener"
              className={btnOutlineClass}
            >
              Tutvu kinnistute oksjonitega
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-container-xl px-md py-lg md:px-lg">
        <section
          id="kontaktvorm"
          className="scroll-mt-28 rounded-card bg-bgMist p-lg lg:scroll-mt-20"
        >
          <div className="grid grid-cols-12 gap-gutter">
            <div className="col-span-12 lg:col-span-5">
              <h2 className="font-heading text-h3 text-ink">
                Müü raieõigus mõistlikult
              </h2>
              <ul className="mt-md space-y-xs">
                {LEAD_FORM_BENEFITS.map((benefit) => (
                  <li
                    key={benefit}
                    className="flex items-center gap-sm text-body text-inkMuted"
                  >
                    <Check
                      className="h-4 w-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-span-12 lg:col-span-7">
              <LeadForm slug="raieoiguse-muuk" />
            </div>
          </div>
        </section>

        <div className="mt-xl">
          <ProcessAccordion groups={PROCESS_GROUPS} />
        </div>

        <section className="mt-xl">
          <h2 className={h2Class}>Tasu ja vastutus</h2>
          <FeeCards cards={FEE_CARDS} className="mt-md" />
        </section>

        <section className="mt-xl">
          <h2 className={h2Class}>Kes sinu metsale pakkumist teeb?</h2>
          <p className="mt-md max-w-container-sm text-body text-inkMuted">
            Iga ostja läbib enne pakkumist eelkontrolli ning annab personaalse
            garantiid.
          </p>
          <div className="mt-md grid gap-gutter sm:grid-cols-3">
            {BUYER_CHECKS.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-card border border-border bg-bgPage p-md shadow-card"
              >
                <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                <h3 className="mt-xs font-heading text-h4 text-ink">{title}</h3>
                <p className="mt-2xs text-bodySm text-inkMuted">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-md rounded-card bg-bgMist p-lg">
            <p className="font-heading text-h3 text-primary">
              {BUYER_COUNT_FALLBACK}
            </p>
            <p className="mt-xs text-body text-inkMuted">
              Kõik pakkumised on anonüümsed: nähtavad on summad ja ajad, mitte
              pakkujate nimed.
            </p>
          </div>
        </section>
      </div>
    </>
  )
}

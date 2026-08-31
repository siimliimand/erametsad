import { LeadForm } from '@eametsad/ui'
import {
  Check,
  Coins,
  History,
  Landmark,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'

import { SealedExplainer } from './_components/SealedExplainer'
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
  title: 'Kinnistu müük oksjonil',
  description:
    'Müü metsakinnistu või põllumaa oksjonil pimepakkumisena: eelkontrollitud ostjad, notariaalne tehing ja 3% teenustasu ainult eduka müügi korral.',
  path: '/teenused/kinnistu-muuk',
})

// Draft copy from docs/design/marketing/03-teenused-kinnistu-muuk.md until
// the Page block builder lands in the CMS. Portal CTA paths follow the design
// doc; the host comes from routing/host-areas.ts (prototype host today).
const PORTAL_KINNISTUD_URL = `https://${PORTAL_HOSTNAME}/kinnistud`
const PORTAL_RAIE_URL = `https://${PORTAL_HOSTNAME}/raie`
const PORTAL_PAKETID_URL = `https://${PORTAL_HOSTNAME}/paketid`

const PROCESS_GROUPS: ProcessStepGroup[] = [
  {
    id: 'eeltöö',
    title: 'Eeltöö',
    steps: [
      {
        title: 'Hindame kinnistu väärtuse',
        description: [
          'Võtame kinnistu andmed üle ja koostame tasuta lähtehinna, tuginedes takseerandmetele, asukohale, teeolukorrale ja sihtotstarbele.',
          'Hindamine ja konsultatsioon on alati tasuta.',
        ],
      },
      {
        title: 'Kokkulepe tingimustes',
        description: [
          'Lepime kokku alghinna või piirhinna ning oksjoni ja tehingu tähtaegade.',
          'Enne oksjoni algust tead täpselt, millistes tingimustes sinu kinnistu müüakse.',
        ],
      },
      {
        title: 'Valmistame dokumendid',
        description: [
          'Kontrollime üle kinnistusraamatu ja piirangud ning valmistame ette notarile vajalikud andmed.',
          'Kõik dokumendid on valmis juba enne oksjoni algust.',
        ],
      },
    ],
  },
  {
    id: 'oksjon',
    title: 'Oksjon',
    steps: [
      {
        title: 'Avalikustame kinnistuoksjoni',
        description: [
          'Kinnistuoksjon avalikustatakse meie portaalis koos fotode, kaardi ja kinnistuandmetega.',
          'Kogu materjal on ostjatele vabalt nähtav, et pakkumised oleksid teadlikud.',
        ],
      },
      {
        title: 'Teavitame kinnistuostjate võrgustikku',
        description: [
          'Teavitame uuest oksjonist oma kontrollitud kinnistuostjate võrgustikku e-posti ja SMS-iga.',
          'Nii jõuab sinu kinnistu potentsiaalsete ostjateni juba esimestel päevadel.',
        ],
      },
      {
        title: 'Kogume suletud pakkumised',
        description: [
          'Oksjon toimub pimepakkumisena: iga ostja esitab tähtajaks ühe pakkumise, mida keegi teine ei näe.',
          'Kuidas pimepakkumine töötab, selgitame allpool.',
        ],
      },
    ],
  },
  {
    id: 'tulemus',
    title: 'Tulemus',
    steps: [
      {
        title: 'Avame pakkumised ja kuulutame võitja',
        description: [
          'Pärast tähtaega avame kõik pakkumised üheaegselt ja kuulutame välja kõrgeima kehtiva pakkumise.',
          'Teenustasu on 3% käibemaksuga võiduhinnast ja see tasutakse ainult eduka müügi korral.',
        ],
      },
      {
        title: 'Sõlmime notariaalse lepingu',
        description: [
          'Sõlmime ostu-müügilepingu notariaalselt: kas e-notaris või kokkulepitud kohtumisel.',
          'Notari ja paberitoimingute korraldus on meie kohustus.',
        ],
      },
      {
        title: 'Jälgime tehingu lõpuni',
        description: [
          'Jälgime, et kanded, maksmine ja kinnistu üleandmine peavad kinni lepingust.',
          'Eametsad vastutab protsessi korrektsuse eest kuni tehingu lõpuni.',
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
  'Turuhind pakkumiste konkurentsi kaudu',
  'Ostjad on eelkontrollitud',
  'Notar ja paberitoimingud korraldame meie',
]

const SERVICE_JSON_LD = buildServiceJsonLd({
  name: 'Kinnistu müük oksjonil',
  description:
    'Metsakinnistu ja põllumaa müük oksjonil pimepakkumisena (suletud pakkumine). Pakkumised esitatakse üheaegselt enne tähtaega ja avatakse korraga, võidab kõrgeim kehtiv pakkumine. Notariaalne tehing, eelkontrollitud ostjad, teenustasu 3% + km ainult eduka müügi korral.',
})

const BREADCRUMB_JSON_LD = buildBreadcrumbJsonLd([
  { name: 'Teenused', path: '/teenused' },
  { name: 'Kinnistu müük oksjonil', path: '/teenused/kinnistu-muuk' },
])

const btnPrimaryClass =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-button bg-primary px-6 font-label font-semibold text-inkInverse transition-all duration-hover ease-hover hover:bg-primaryHover motion-reduce:transition-none md:w-auto'
const btnOutlineClass =
  'inline-flex h-12 w-full items-center justify-center rounded-button border border-primary bg-transparent px-6 font-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight motion-reduce:transition-none md:w-auto'
const h2Class = 'font-heading text-h2 text-ink'

// Live buyer counts come from GET /api/v1/statistics once a server-side data
// helper lands on this static page; until then the design doc's documented
// fallback copy renders (doc 03, States via doc 02).
const BUYER_COUNT_FALLBACK = 'Üle 200 kontrollitud kinnistuostjat'

export default function KinnistuMuukPage() {
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
            Kinnistu müük oksjonil
          </h1>
          <p className="mt-md max-w-container-sm text-body text-inkMuted">
            Müü metsakinnistu või põllumaa ühe tervikuna oksjonil. Ostjate
            konkurents toob välja kinnistu tegeliku turuväärtuse ja tehing
            viiakse lõpuni notariaalselt.
          </p>
          <div className="mt-md flex flex-col gap-xs md:flex-row">
            <a
              href={PORTAL_KINNISTUD_URL}
              target="_blank"
              rel="noopener"
              className={btnPrimaryClass}
            >
              Tutvu kinnistute oksjonitega
            </a>
            <a
              href={PORTAL_RAIE_URL}
              target="_blank"
              rel="noopener"
              className={btnOutlineClass}
            >
              Tutvu raieõiguste oksjonitega
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
                Müü kinnistu mõistlikult
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
              <LeadForm slug="kinnistu-muuk" />
            </div>
          </div>
        </section>

        <div className="mt-xl">
          <ProcessAccordion groups={PROCESS_GROUPS} />
        </div>

        <SealedExplainer />

        <section className="mt-xl rounded-card bg-bgMist p-lg">
          <div className="flex flex-col gap-md md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-heading text-h3 text-ink">
                Sul on mitu kinnistut?
              </h2>
              <p className="mt-xs max-w-container-sm text-body text-inkMuted">
                Pakettoksjon liidab huvilised ühte: mitu kinnistut müüakse ühe
                oksjonina ja konkurents kehtib kogu paketile.
              </p>
              <p className="mt-xs text-bodySm text-inkMuted">
                Müüd raieõigust?{' '}
                <Link
                  href="/teenused/raieoiguse-muuk"
                  className="font-semibold text-primary underline underline-offset-2 transition-colors duration-hover ease-hover hover:text-primaryHover motion-reduce:transition-none"
                >
                  Loe raieõiguse müügist
                </Link>
              </p>
            </div>
            <a
              href={PORTAL_PAKETID_URL}
              target="_blank"
              rel="noopener"
              className={btnPrimaryClass}
            >
              Vaata pakettoksjonite võimalust
            </a>
          </div>
        </section>

        <section className="mt-xl">
          <h2 className={h2Class}>Tasu ja vastutus</h2>
          <FeeCards cards={FEE_CARDS} className="mt-md" />
        </section>

        <section className="mt-xl">
          <h2 className={h2Class}>Kes sinu kinnistule pakkumist teeb?</h2>
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

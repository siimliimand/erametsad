import { Card, LeadForm } from '@eametsad/ui'
import {
  Layers,
  MapPin,
  ShieldAlert,
  Sprout,
  TreePine,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'

import { buildServiceJsonLd, toJsonLdScript } from '../_lib/jsonld'
import { buildMetadata } from '../_lib/seo'
import { CopyEmailButton } from './_components/CopyEmailButton'
import { SectionNav } from './_components/SectionNav'

export const revalidate = 3600

// Draft address from docs/design/marketing/06-hindamisaktid.md until a
// settings seed defines the final alias.
const ORDER_EMAIL = 'hindamisakt@eametsad.ee'
const ORDER_MAILTO = `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent('Hindamisakti tellimus')}`

const SECTIONS = [
  { id: 'metoodika', title: 'Metoodika' },
  { id: 'hinna-mojutegurid', title: 'Hinna mõjutegurid' },
  { id: 'andmeallikad', title: 'Andmeallikad' },
  { id: 'hind', title: 'Hind' },
  { id: 'tellimine', title: 'Tellimine' },
]

const PRICE_FACTORS = [
  {
    icon: MapPin,
    title: 'Asukoht ja ligipääs',
    text: 'Hind tõuseb heade teede ja logistika lähedal.',
  },
  {
    icon: TreePine,
    title: 'Puuliigi koosseis',
    text: 'Okaspuupuistud on tavaliselt väärtuslikumad kui lehtpuud.',
  },
  {
    icon: Layers,
    title: 'Puistu vanus ja mahud',
    text: 'Suurem tagavara ja raieküps puistu tõstavad hinnangut.',
  },
  {
    icon: Sprout,
    title: 'Mullaproduktiivsus',
    text: 'Produktiivsem mullavõrk tähendab suuremat juurdekasvu.',
  },
  {
    icon: ShieldAlert,
    title: 'Piirangud',
    text: 'Kaitsealad ja veekaitsed vähendavad hindamisakti hinda.',
  },
  {
    icon: TrendingUp,
    title: 'Metsamaterjali turuhinnad',
    text: 'Lähtume ajakohastest turuhindadest ja oksjonitulemustest.',
  },
]

const jsonLd = buildServiceJsonLd({
  name: 'Hindamisakti koostamine',
  offers: {
    price: 480,
    priceCurrency: 'EUR',
    description: 'Hindamisakt alates 480 € + käibemaks',
  },
})

export const metadata = buildMetadata({
  title: 'Hindamisaktid — metsa ja põllumaa hindamisakt',
  description:
    'Koostame maatulundusmaa hindamisaktid kogu Eestis — müügiks, laenuks, päranduseks või kohtulikuks vaidluseks. Hind alates 480 € + km.',
  path: '/hindamisaktid',
})

const h2Class = 'font-heading text-h2 text-ink'
const btnPrimaryClass =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-button bg-primary px-6 font-label font-semibold text-ink-inverse transition-all duration-hover ease-hover hover:bg-primary-hover motion-reduce:transition-none md:w-auto'

export default function HindamisaktidPage() {
  return (
    <main className="pb-2xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(jsonLd) }}
      />

      <section className="bg-bgMist">
        <div className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
          <h1 className="max-w-container-sm font-heading text-h1 text-ink">
            Hindamisaktid metsa- ja põllumaale
          </h1>
          <p className="mt-md max-w-container-sm text-body text-inkMuted">
            Koostame maatulundusmaa hindamisaktid kogu Eestis — müügiks, laenuks,
            päranduseks või kohtulikuks vaidluseks.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-container-xl px-md py-lg md:px-lg">
        <div className="grid grid-cols-12 gap-gutter">
          <div className="col-span-12 lg:col-span-4">
            <SectionNav sections={SECTIONS} />
          </div>

          <div className="col-span-12 space-y-xl lg:col-span-8">
            <section id="metoodika" className="scroll-mt-28 lg:scroll-mt-20">
              <h2 className={h2Class}>1. Metoodika</h2>
              <ul className="mt-md list-disc space-y-2 pl-6 text-body text-inkMuted marker:text-primary">
                <li>Võrdlev tehinguanalüüs Maa-ameti tehingute andmebaasi põhjal.</li>
                <li>
                  Oma lõppenud oksjonite reaaltulemused — ainulaadne andmepõhine
                  eelis. Vaata{' '}
                  <Link
                    href="/artiklid"
                    className="font-semibold text-primary underline hover:text-primary-hover"
                  >
                    artikleid ja statistikat
                  </Link>
                  .
                </li>
                <li>
                  Kommentaar selle kohta, mis eristab turuhinda ja takseerihinda.
                </li>
              </ul>
            </section>

            <section
              id="hinna-mojutegurid"
              className="scroll-mt-28 lg:scroll-mt-20"
            >
              <h2 className={h2Class}>2. Hinna mõjutegurid</h2>
              <div className="mt-md grid gap-gutter sm:grid-cols-2">
                {PRICE_FACTORS.map(({ icon: Icon, title, text }) => (
                  <Card key={title} hover={false}>
                    <div className="p-6">
                      <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                      <h3 className="mt-xs font-heading text-h4 text-ink">
                        {title}
                      </h3>
                      <p className="mt-2xs text-bodySm text-inkMuted">{text}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            <section id="andmeallikad" className="scroll-mt-28 lg:scroll-mt-20">
              <h2 className={h2Class}>3. Andmeallikad</h2>
              <ul className="mt-md list-disc space-y-2 pl-6 text-body text-inkMuted marker:text-primary">
                <li>Takseerandmed metsamajanduskavadest.</li>
                <li>Maa-ameti avalikud kaardi- ja ortofotoandmed.</li>
                <li>
                  Automaatne metsainventuur — kasutame AI-põhise inventuuri
                  andmeid, mida võrdleme alati takseerandmetega.
                </li>
                <li>Avalikud põllumajandusandmed.</li>
              </ul>
            </section>

            <section id="hind" className="scroll-mt-28 lg:scroll-mt-20">
              <h2 className={h2Class}>4. Hind</h2>
              <div className="mt-md rounded-card bg-bgMist p-lg">
                <p className="font-heading text-h2 text-primary">alates 480 € + km</p>
                <p className="mt-xs text-body text-inkMuted">
                  Lõpphind sõltub kinnistute arvust ja nende kaugusest.
                </p>
                <table className="mt-md w-full text-left text-bodySm">
                  <caption className="sr-only">Hindamisakti hinnanäited</caption>
                  <thead>
                    <tr className="border-b border-border">
                      <th scope="col" className="py-2 pr-4 font-semibold text-ink">
                        Kinnistuid
                      </th>
                      <th scope="col" className="py-2 font-semibold text-ink">
                        Hind
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="py-2 pr-4">1 kinnistu</td>
                      <td className="py-2">alates 480 € + km</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">mitu kinnistut</td>
                      <td className="py-2">soodustus kokkuleppel</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section id="tellimine" className="scroll-mt-28 lg:scroll-mt-20">
              <h2 className={h2Class}>5. Tellimine</h2>
              <p className="mt-md text-body text-inkMuted">
                Kirjuta meile katastritunnused ja oma kontaktandmed — vastame
                pakkumisega ja täpsustame lõpphinna.
              </p>
              <div className="mt-md flex flex-col gap-xs md:flex-row md:items-center">
                <a href={ORDER_MAILTO} className={btnPrimaryClass}>
                  Saada tellimus e-postile
                </a>
                <CopyEmailButton email={ORDER_EMAIL} />
              </div>
              <p className="mt-xs text-bodySm text-inkMuted">
                Kasutad veebiposti? Kopeeri aadress ja kirjuta oma postkontorist.
              </p>
              <p className="mt-md border-l-4 border-accent bg-bgMist p-md text-bodySm text-inkMuted">
                Hindamisakt ei ole tasuta konsultatsioon — tasuta on suuline
                lähtehindamine.{' '}
                <Link
                  href="/teenused/metsa-hindamine"
                  className="font-semibold text-primary underline hover:text-primary-hover"
                >
                  Vaata tasuta hindamist
                </Link>
                .
              </p>
            </section>
          </div>
        </div>

        <section
          id="kontaktvorm"
          className="mt-xl scroll-mt-28 rounded-card bg-bgMist p-lg lg:scroll-mt-20"
        >
          <h2 className="max-w-container-sm font-heading text-h3 text-ink">
            Ei tea, kas akt on sul vaja? Kirjuta — vastame 1 tööpäevaga.
          </h2>
          <div className="mt-md max-w-container-sm">
            <LeadForm slug="hindamisaktid" />
          </div>
        </section>
      </div>
    </main>
  )
}

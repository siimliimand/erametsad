import { Card, LeadForm } from '@eametsad/ui'
import Link from 'next/link'

import { ScreenshotSteps, type TutorialStep } from './_components/ScreenshotSteps'
import { buildHowToJsonLd, toJsonLdScript } from '../_lib/jsonld'
import { buildMetadata } from '../_lib/seo'

export const revalidate = 3600

// Draft step copy and captions from docs/design/marketing/05-metsateatis.md
// (8 original steps). Screenshots of register.metsad.ee are pending — each
// step keeps a null image slot that the lightbox enlarges until real
// captures land in /public.
const STEPS: TutorialStep[] = [
  {
    title: 'Logi sisse metsaportaali',
    text: 'Ava metsaportaal register.metsad.ee. Logi sisse ID-kaardi, Mobiil-ID või Smart-IDga.',
    image: null,
    imageAlt: 'Metsaportaal: sisselogimisvaade ID-kaardi, Mobiil-ID ja Smart-ID valikuga',
    caption: 'Sisselogimise kuvatõmmis — register.metsad.ee',
    link: {
      href: 'https://register.metsad.ee',
      label: 'Ava metsaportaal',
      external: true,
    },
  },
  {
    title: 'Ava MINU metsad',
    text: 'Pärast sisselogimist avaneb sinu metsade loend. Vali sealt üles see kinnistu, kus raie planeerid.',
    image: null,
    imageAlt: 'Metsaportaal: menüü MINU on üleval paremal, all sinu metsade loend',
    caption: 'MINU metsade loendi kuvatõmmis — Portaal',
  },
  {
    title: 'Vali raielangid',
    text: 'Vali katastriüksus ja selle eraldised kaardilt või loendist. Kontrolli üle, et valik vastab sellele alale, kus metsateatis esitatakse.',
    image: null,
    imageAlt: 'Metsaportaal: kaardivaade valitud katastriüksuse ja eraldistega',
    caption: 'Raielangide valiku kuvatõmmis — Kaart',
  },
  {
    title: 'Alusta metsateatist',
    text: 'Vajuta nuppu „Sisesta metsateatis“. Andmed on takseerist eeltäidetud — kontrolli raiemahusid üle.',
    image: null,
    imageAlt: 'Metsaportaal: avatud metsateatise vorm eeltäidetud andmetega',
    caption: 'Nupu „Sisesta metsateatis“ kuvatõmmis — Portaal',
  },
  {
    title: 'Lisa raielangi aadress',
    text: 'Lisa raielangi aadress ja salvesta see nupuga „Salvesta aadress“.',
    image: null,
    imageAlt: 'Metsaportaal: raielangi aadressi vorm ja nupp Salvesta aadress',
    caption: 'Aadressi lisamise kuvatõmmis — Portaal',
  },
  {
    title: 'Märgi raiemahu avalikustamine',
    text: 'Märgi märkeruudust, kas avalikustad raiemahu või mitte.',
    image: null,
    imageAlt: 'Metsaportaal: märkeruut raiemahu avalikustamiseks',
    caption: 'Raiemahu avalikustamise kuvatõmmis — Portaal',
  },
  {
    title: 'Kontrolli ja esita',
    text: 'Kontrolli kõik andmed üle ja vajuta nuppu „Esita“. Peale esitamist saab teatis registreerimisnumbri.',
    image: null,
    imageAlt: 'Metsaportaal: andmete kontrolli vaade ja nupp Esita',
    caption: 'Kontrolli ja esita kuvatõmmis — Portaal',
  },
  {
    title: 'Jälgi staatust',
    text: 'Jälgi teatise staatust portaalis: kinnitus on kas ootel või kinnitatud. Kinnituse järel saad edasi liikuda.',
    image: null,
    imageAlt: 'Metsaportaal: teatise staatus kinnituse ootel või kinnitatud',
    caption: 'Teatise staatuse kuvatõmmis — Portaal',
  },
]

// Sidebar "Vaata lisa" per the design doc. The two SEO articles are planned
// (docs/research/main-site-map.md) — routes land in a later task.
const SIDEBAR_LINKS = [
  { href: '/metsateatise-muutmine', label: 'Metsateatise muutmine' },
  { href: '/kahjustusest-teatamine', label: 'Kahjustusest teatamine' },
  { href: '/kkk/metsandus', label: 'KKK: metsandus ja raie' },
  { href: '/teenused/raieoiguse-muuk', label: 'Raieõiguse müük' },
]

// Klienditugi number from the seeded FAQ copy (see src/app/error.tsx) until
// settings seed carries a dedicated line.
const SUPPORT_PHONE = '+372 6000 000'
const SUPPORT_PHONE_HREF = 'tel:+3726000000'

// HowToStep images are omitted while screenshots are pending.
const howToJsonLd = buildHowToJsonLd({
  name: 'Metsateatise esitamine metsaportaalis',
  description:
    'Samm-sammuline juhend metsateatise esitamiseks metsaportaalis register.metsad.ee.',
  steps: STEPS,
})

export const metadata = buildMetadata({
  title: 'Metsateatise esitamine — juhend piltidega',
  description:
    'Samm-sammuline juhend metsateatise esitamiseks metsaportaalis register.metsad.ee: sisselogimine, raielangide valik, esitamine ja staatuse jälgimine.',
  path: '/metsateatis',
})

export default function MetsateatisPage() {
  return (
    <main className="pb-2xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(howToJsonLd) }}
      />

      <section className="bg-bgMist">
        <div className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
          <h1 className="max-w-container-sm font-heading text-h1 text-ink">
            Metsateatise esitamine metsaportaalis
          </h1>
          <p className="mt-md max-w-container-sm text-body text-inkMuted">
            Metsateatis on digitaalne teatis, millega teavitad Keskkonnaametit
            kavandatavast raiejast. Juhend viib sind portaalist esitamiseni
            samm-sammult.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-container-xl px-md py-lg md:px-lg">
        <div className="grid grid-cols-12 gap-gutter">
          <div className="col-span-12 lg:col-span-8">
            <section id="juhend" className="scroll-mt-28 lg:scroll-mt-20">
              <h2 className="font-heading text-h2 text-ink">
                Samm-sammult koos piltidega
              </h2>
              <p className="mt-md max-w-container-sm text-body text-inkMuted">
                Klikka kuvatõmmisel, et seda suurendada.
              </p>
              <div className="mt-md">
                <ScreenshotSteps steps={STEPS} />
              </div>
            </section>
          </div>

          <aside className="col-span-12 lg:col-span-4" aria-label="Vaata lisa">
            <div className="space-y-md lg:sticky lg:top-20">
              <Card hover={false} className="p-6">
                <h2 className="font-heading text-h4 text-ink">Vaata lisa</h2>
                <ul className="mt-sm space-y-2">
                  {SIDEBAR_LINKS.map(({ href, label }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="font-semibold text-primary underline hover:text-primary-hover"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card hover={false} id="kontaktvorm" className="scroll-mt-28 p-6">
                <h2 className="font-heading text-h4 text-ink">
                  Vajad abi metsateatise täitmisel?
                </h2>
                <div className="mt-sm">
                  <LeadForm slug="metsateatis" />
                </div>
              </Card>
            </div>
          </aside>
        </div>
      </div>

      <section className="bg-primaryDark">
        <div className="mx-auto max-w-container-xl px-md py-xl text-center md:px-lg">
          <h2 className="max-w-container-sm font-heading text-h3 text-ink-inverse">
            Ei tule välja? Helista — täidame teatise koos läbi.
          </h2>
          <a
            href={SUPPORT_PHONE_HREF}
            className="mt-md inline-flex h-14 items-center justify-center rounded-button bg-bgPage px-8 font-heading text-h4 text-ink transition-colors duration-hover ease-hover hover:bg-bgMist motion-reduce:transition-none"
          >
            {SUPPORT_PHONE}
          </a>
        </div>
      </section>
    </main>
  )
}

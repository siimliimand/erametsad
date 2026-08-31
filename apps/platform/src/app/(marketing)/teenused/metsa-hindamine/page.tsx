import type { TickerLotSummary } from '../../_components/HomeTicker'
import {
  buildBreadcrumbJsonLd,
  buildServiceJsonLd,
  toJsonLdScript,
} from '../../_lib/jsonld'
import { buildMetadata } from '../../_lib/seo'
import {
  SeoArticleTemplate,
  type SeoArticleSection,
} from '../_components/SeoArticleTemplate'

import { listAuctions, type AuctionSummary } from '@/lib/auction/queries'
import type { CoreRepositories } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'

// D7 asks for ISR (revalidate = 3600), but CI and deploy builds run
// `next build` without a seeded D1, and the shared marketing layout reads
// the CMS for the header, footer, and contact band — prerendering would
// start wrangler's remote-binding proxy and fail without an API token.
// Drop `force-dynamic` (and make the layout reads build-safe) once
// build-time D1 seeding exists.
export const dynamic = 'force-dynamic'

export const metadata = buildMetadata({
  title: 'Metsa väärtuse hindamine — kuidas arvutada metsa hind',
  description:
    'Mis metsa hinda määrab: asukoht, puuliigid, maht ja kulud. Loe, kuidas metsa väärtust hinnatakse, ja telli tasuta hindamine — vastame ühe tööpäeva jooksul.',
  path: '/teenused/metsa-hindamine',
})

// Draft copy from docs/design/marketing/04-teenused-metsa-hindamine.md; the
// article body moves behind the SEOArticle CMS collection (doc 04, Admin)
// once it exists. First instance of SeoArticleTemplate.
const H1 = 'Metsa väärtuse hindamine'
const INTRO =
  'Metsa hind ei ole üks number — see on asukoha, puuliikide, mahu ja kulude summa. Selgitame lahti, mis sinu metsa hinda tõstab ja mida langetab.'

const LEAD_FORM_HEADING =
  'Tahad teada, kui palju sinu mets väärt on? Hindame tasuta.'
const CLOSING_FORM_HEADING =
  'Soovid tasuta hindamist? Jäta meile enda andmed.'
const CTA_HEADING = 'Konsultatsioon on tasuta'
const CTA_TEXT = 'Ei ole kohustusi — vastame 1 tööpäeva jooksul.'
const CTA_BUTTON_LABEL = 'Küsi nõu'

const ARTICLE_SECTIONS: SeoArticleSection[] = [
  {
    id: 'asukoht',
    heading: 'Kus sinu mets asub — asukoha mõju hinnale',
    paragraphs: [
      'Metsa hind algab asukohast. Mida lähemal on metsaal teedele, sadamatele ja puitu töötlevatele ettevõtetele, seda väiksemad on veokulud ja seda kõrgem on hind, mida ostja on valmis maksma. Kaugele või halvasti ligipääsetavale maale jäävad need kulud pakkumises kajastuma ja vähendavad müüja saaki.',
      'Lisaks asukohale loeb piirkondlik nõudlus. Seal, kus tegutseb palju metsaostjaid ja raietööde korraldajaid, tekib ostjate vahel konkurents ja hinnad on kõrgemad. Väärtust tõstab ka hea kasvukoht: viljakal mineraalmaal kasvab mets kiiremini ning puit on sirgem ja kvaliteetsem.',
    ],
  },
  {
    id: 'saagi-hind',
    heading: 'Mis saagi hind sisaldab — puuliigid ja mahud',
    paragraphs: [
      'Suur osa metsa väärtusest peitub puistu koosseisus. Kõige väärtuslikum on saematerjaliks sobiv okaspuit — mänd ja kuusk. Lehtpuudest hinnatakse kõrgemalt kaski, samas kui haab ja sialep on enamikus piirkondades tagasihoidlikuma hinnaga.',
      'Oluline on ka maht. Suurema raielõigu puhul jaotuvad püsi- ja ettevalmistuskulud suurema koguse peale, mistõttu on kuupmeetri hind tavaliselt parem kui väikestel lõikudel.',
      'Puistu vanus ja tüve kvaliteet määravad, kas puit läheb saematerjaliks või odavamaks tselluloosipuiduks. Sirge, paks ja oksavaba tüvi toob märksa kõrgema hinna kui hõre või kahjustatud puistu.',
    ],
  },
  {
    id: 'kulud',
    heading: 'Ülestöötamise ja väljaveo kulud',
    paragraphs: [
      'Metsa väärtus on alati netosumma: raietulust lahutatakse raietööd, teede ettevalmistus, väljavedu ja metsa uuendamine. Soodsa reljeefi ja olemasoleva teevõrgustikuga maal jääb neid kulutusi vähem ning müüjale jääb rohkem.',
      'Kui müüd raieõigust, korraldab tööd tavaliselt ostja, aga iga kulutegur on siiski hinnas sisaldatud. Enne müüki tasub täpsustada, kes tasub raieloa ja teekasutuse ning kes vastutab metsa uuendamise eest — just need üksikasjad mõjutavad pakkumise suurust.',
    ],
  },
  {
    id: 'lepingud',
    heading: 'Riskantsed lepinguvormid, mida vältida',
    paragraphs: [
      'Mitte kõik müügiviisid ei ole müüjale ühepajult ohutud. Suurim risk on leping, kus lõpphind sõltub ainult ostja enda mõõtmisest ja arvestusest, millele müüja ei saa kaasa vaadata. Sellisel juhul võib tegelik saak jääda selgitamata ja hind madalaks.',
      'Ettevaatust nõuavad ka liiga pikad tähtajad, kus hind on fikseeritud aastateks ette, samal ajal kui puiduturu hinnad liiguvad. Läbipaistev müük avalikul oksjonil võimaldab võrrelda mitut ostjat ja näha, kelle pakkumine on tõesti parim.',
    ],
  },
  {
    id: 'oige-aeg',
    heading: 'Õige aeg metsa müüa',
    paragraphs: [
      'Puidu hinnad liiguvad tsükliliselt koos ehitustegevuse, ekspordituru ja puidutööstuse nõudlusega. Kui turg on tugev, konkureerivad ostjad aktiivsemalt ja lõpptulemus on müüjale soodsam.',
      'Aastaaeg mõjutab kulusid: talvel, kui maa on külmunud ja väljaveoteed kannatavad vähem, on raie- ja veokulud tavaliselt madalamad. Ka metsa seisukord loeb — haiguste või kahjurite poolt nõrgestatud puistu tasub müüa enne, kui selle väärtus hakkab kahanema.',
    ],
  },
  {
    id: 'oksjon',
    heading: 'Kuidas oksjon hinna kujundab',
    paragraphs: [
      'Oksjoni mõte on lihtne: sama objekti näevad korraga paljud ostjad ja pakkumised konkureerivad omavahel. Nii kujuneb hind turu põhjal, mitte ühe ostja hinnangul, ja müüja näeb, kui palju tema mets tegelikult väärt on.',
      'Eametsad korraldab müügi algusest lõpuni: hindame metsa tasuta, valmistame dokumendid ning foto- ja kaardimaterjali, paneme paika alghinna ja teavitame kontrollitud ostjate võrgustikku. Pakkumised on anonüümsed — nähtavad on summad ja ajad, mitte pakkujate nimed.',
      'Edukustasu on 3% käibemaksuga võiduhinnast ja seda tasutakse ainult pärast edukat müüki. Kui oksjon jääb müümata, ei maksa müüja midagi ja müügi võib korrata.',
    ],
  },
]

const SERVICE_JSON_LD = buildServiceJsonLd({
  name: 'Metsa väärtuse hindamine',
})

const BREADCRUMB_JSON_LD = buildBreadcrumbJsonLd([
  { name: 'Teenused', path: '/teenused' },
  { name: H1, path: '/teenused/metsa-hindamine' },
])

async function loadTickerLots(
  repos: CoreRepositories | null,
): Promise<TickerLotSummary[]> {
  if (!repos) return []
  try {
    const search = new URLSearchParams({
      auctionStatus: 'active',
      sort: 'endTime',
      order: 'asc',
      limit: '4',
    })
    const { auctions } = await listAuctions(repos, search)
    return auctions.filter(
      (lot): lot is AuctionSummary & { endsAt: string } => lot.endsAt !== null,
    )
  } catch {
    return []
  }
}

export default async function MetsaHindaminePage() {
  let repos: CoreRepositories | null = null
  try {
    repos = await getRepositories()
  } catch {
    // No D1 binding: the ticker degrades to its empty state.
    repos = null
  }
  const tickerLots = await loadTickerLots(repos)

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
      <SeoArticleTemplate
        title={H1}
        intro={INTRO}
        leadFormHeading={LEAD_FORM_HEADING}
        closingFormHeading={CLOSING_FORM_HEADING}
        leadSlug="metsa-hindamine"
        tickerLots={tickerLots}
        sections={ARTICLE_SECTIONS}
        ctaHeading={CTA_HEADING}
        ctaText={CTA_TEXT}
        ctaButtonLabel={CTA_BUTTON_LABEL}
      />
    </>
  )
}

import type { Payload } from 'payload'

function rt(text: string): unknown {
  return {
    root: {
      children: [
        {
          type: 'paragraph',
          children: [{ text }],
        },
      ],
    },
  }
}

export async function seedCms(payload: Payload): Promise<void> {
  const existing = await payload.find({ collection: 'pages', limit: 1 })
  if (existing.totalDocs > 0) {
    console.log('CMS pages already seeded, skipping')
    return
  }

  // ── HOMEPAGE ──
  await payload.create({
    collection: 'pages',
    data: {
      title: 'Avaleht',
      slug: 'avaleht',
      status: 'published',
      layout: [
        {
          blockType: 'hero',
          heading: 'Erametsad – oksjonikeskkond metsaomanikele',
          subheading: 'Osta ja müü metsa raieõigusi, kinnistuid ja muud metsavara turvaliselt ja läbipaistvalt.',
          ctaText: 'Vaata oksjoneid',
          ctaLink: '/oksjonid',
        },
        {
          blockType: 'stats',
          items: [
            { label: 'Läbiviidud oksjoneid', value: '1 247', suffix: '' },
            { label: 'Aktiivseid kasutajaid', value: '3 500', suffix: '+' },
            { label: 'Keskmine oksjonihind', value: '12 500', suffix: '€' },
            { label: 'Metsa müüdud', value: '15 000', suffix: 'ha+' },
          ],
        },
        {
          blockType: 'testimonial',
          testimonial: undefined,
        },
        {
          blockType: 'cta',
          text: 'Liitu Erametsadega juba täna',
          buttonText: 'Registreeru',
          buttonLink: '/register',
        },
      ],
      publishedAt: new Date(),
    },
  })

  // ── SERVICE PAGES ──
  const services = [
    {
      title: 'Metsa hindamine',
      slug: 'metsa-hindamine',
      layout: [
        { blockType: 'hero', heading: 'Metsa hindamine', subheading: 'Professionaalne metsa hindamine ja ekspertiis' },
        {
          blockType: 'text',
          content: rt('Pakume metsa hindamise teenust, mis hõlmab metsa inventuuri, puistu vanuse ja liigilise koosseisu määramist, raieõiguse turuväärtuse hindamist ja metsa majandamise soovitusi.'),
        },
        {
          blockType: 'cards',
          heading: 'Meie hindamisteenused',
          cards: [
            { title: 'Metsa inventuur', description: 'Puistu liigiline koosseis, vanus ja tüsedus', icon: 'TreePine', link: '' },
            { title: 'Raieõiguse hindamine', description: 'Turuväärtuse määramine enne oksjonit', icon: 'Euro', link: '' },
            { title: 'Metsamajanduskava', description: 'Pikaajaline metsa majandamise plaan', icon: 'FileText', link: '' },
          ],
        },
      ],
    },
    {
      title: 'Metsa müük',
      slug: 'metsa-muuk',
      layout: [
        { blockType: 'hero', heading: 'Metsa müük', subheading: 'Müü oma metsavara parima hinnaga' },
        {
          blockType: 'text',
          content: rt('Metsa müük oksjoni kaudu on parim viis õiglase turuhinna saamiseks. Meie platvorm ühendab sind tuhandete ostjatega üle Eesti.'),
        },
        {
          blockType: 'steps',
          heading: 'Müügiprotsess',
          steps: [
            { title: '1. Kontakteeru', description: 'Võta ühendust ja kirjelda oma metsa' },
            { title: '2. Hinnang', description: 'Spetsialist hindab sinu metsa väärtust' },
            { title: '3. Oksjon', description: 'Mets pannakse oksjonile meie platvormil' },
            { title: '4. Müük', description: 'Parim pakkumine võidab ja leping sõlmitakse' },
          ],
        },
      ],
    },
    {
      title: 'Metsa hooldus',
      slug: 'metsa-hooldus',
      layout: [
        { blockType: 'hero', heading: 'Metsa hooldus', subheading: 'Säästlik ja professionaalne metsa hooldus' },
        {
          blockType: 'text',
          content: rt('Pakkume metsa hooldusteenuseid alates noore metsa hooldusest kuni valikraieni. Meie spetsialistid aitavad sul hoida metsa tervena ja väärtuslikuna.'),
        },
        {
          blockType: 'accordion',
          heading: 'Hooldusteenused',
          items: [
            { title: 'Noore metsa hooldus', content: rt('Noore metsa hooldus hõlmab liigasisest ja liikidevahelist valikut, et tagada kvaliteetne puistu.'), },
            { title: 'Valikraie', content: rt('Valikraie võimaldab säilitada metsa looduslikku mitmekesisust ja tagada pidev metsakate.'), },
            { title: 'Sanitaarraie', content: rt('Sanitaarraie eesmärk on eemaldada kahjustatud või haiged puud, et vältida kahjurite levikut.'), },
          ],
        },
      ],
    },
  ]

  for (const page of services) {
    await payload.create({
      collection: 'pages',
      data: { ...page, status: 'published', publishedAt: new Date() },
    })
  }

  // ── FAQ CATEGORIES ──
  const FAQ_CATEGORIES: { title: string; slug: string; order: number }[] = [
    { title: 'Üldine', slug: 'uldine', order: 1 },
    { title: 'Oksjon', slug: 'oksjon', order: 2 },
    { title: 'Maksmine', slug: 'maksmine', order: 3 },
    { title: 'Metsandus', slug: 'metsandus', order: 4 },
    { title: 'Õigus', slug: 'oigus', order: 5 },
    { title: 'Tehniline', slug: 'tehniline', order: 6 },
    { title: 'Kontakt', slug: 'kontakt', order: 7 },
  ]

  const categoryDocs: Record<string, { id: string | number }> = {}
  for (const cat of FAQ_CATEGORIES) {
    const doc = await payload.create({
      collection: 'faq-categories',
      data: cat,
    })
    // Keep the id as returned: Payload rejects numeric strings for
    // number-typed relationship ids.
    categoryDocs[cat.slug] = { id: doc.id }
  }

  // ── FAQ ITEMS ──
  const FAQ_ITEMS: { question: string; answer: string; categorySlug: string; order: number; slug: string }[] = [
    { question: 'Mis on Erametsad?', answer: 'Erametsad on Eesti metsaomanikele loodud oksjonikeskkond, kus saab osta ja müüa metsa raieõigusi, kinnistuid ja muud metsavara.', categorySlug: 'uldine', order: 1, slug: 'mis-on-erametsad' },
    { question: 'Kes saab Erametsasid kasutada?', answer: 'Erametsad on avatud kõigile Eesti elanikele ja ettevõtetele. Ostmiseks ja müümiseks on vaja luua konto.', categorySlug: 'uldine', order: 2, slug: 'kes-saab-kasutada' },
    { question: 'Kas Erametsad on tasuta?', answer: 'Oksjoni vaatamine ja pakkumiste tegemine on tasuta. Müüjalt võetakse edukalt müüdud oksjoni puhul vahendustasu.', categorySlug: 'uldine', order: 3, slug: 'kas-tasuta' },
    { question: 'Kuidas luua konto?', answer: 'Konto loomiseks vajuta "Registreeru" nuppu ja täida vajalikud andmed. Saad kasutada nii e-posti kui eID autentimist.', categorySlug: 'uldine', order: 4, slug: 'kuidas-luua-konto' },
    { question: 'Kuidas Erametsad kaitseb minu andmeid?', answer: 'Kõik isikuandmed on kaitstud vastavalt isikuandmete kaitse seadusele. Pakkujate identiteet on oksjoni ajal anonüümne.', categorySlug: 'uldine', order: 5, slug: 'andmekaitse' },

    { question: 'Kuidas oksjon toimib?', answer: 'Metsaomanik paneb oma metsavara oksjonile, määrates alghinna. Ostjad teevad pakkumisi ja kõrgeim pakkumine võidab.', categorySlug: 'oksjon', order: 1, slug: 'kuidas-oksjon-toimib' },
    { question: 'Mis on automaatpakkumine?', answer: 'Automaatpakkumine võimaldab seada maksiimumpakkumise, mille piires süsteem tõstab sinu pakkumist automaatselt.', categorySlug: 'oksjon', order: 2, slug: 'automaatpakkumine' },
    { question: 'Kas oksjoni aega pikendatakse?', answer: 'Kui pakkumine tehakse viimase 5 minuti jooksul, pikendatakse oksjoni aega 5 minuti võrra.', categorySlug: 'oksjon', order: 3, slug: 'aja-pikendamine' },
    { question: 'Mis juhtub peale oksjoni lõppu?', answer: 'Võitja ja müüja vahel sõlmitakse leping. Maksmine toimub lepingus kokkulepitud tingimustel.', categorySlug: 'oksjon', order: 4, slug: 'peale-oksjoni' },
    { question: 'Mis on pitseritud pakkumine?', answer: 'Pitseritud pakkumine on kinnine pakkumine, mida teised pakkujad ei näe. See avatakse pärast oksjoni lõppu.', categorySlug: 'oksjon', order: 5, slug: 'pitseritud-pakkumine' },

    { question: 'Milliseid makseviise toetate?', answer: 'Toetame pangalinke ja traditsioonilist arveldust. Täpsem info maksetingimustes.', categorySlug: 'maksmine', order: 1, slug: 'makseviisid' },
    { question: 'Kui suur on vahendustasu?', answer: 'Vahendustasu on 3% + käibemaks edukalt müüdud oksjoni lõpphinnast.', categorySlug: 'maksmine', order: 2, slug: 'vahendustasu' },
    { question: 'Millal tuleb vahendustasu maksta?', answer: 'Vahendustasu arvestatakse peale oksjoni edukat lõppemist ja lepingu sõlmimist.', categorySlug: 'maksmine', order: 3, slug: 'vahendustasu-makseaeg' },
    { question: 'Kas hindadele lisandub käibemaks?', answer: 'Kõik hinnad on näidatud käibemaksuga (s.h. käibemaks).', categorySlug: 'maksmine', order: 4, slug: 'km' },

    { question: 'Kuidas hinnata metsa väärtust?', answer: 'Metsa väärtus sõltub puistu liigilisest koosseisust, vanusest, asukohast ja raieõiguse tüübist. Soovitame tellida professionaalne hinnang.', categorySlug: 'metsandus', order: 1, slug: 'metsa-vaartus' },
    { question: 'Mis on raieõigus?', answer: 'Raieõigus on õigus langetada ja välja vedada metsa kindlaksmääratud alal vastavalt metsamajandamise nõuetele.', categorySlug: 'metsandus', order: 2, slug: 'raieoigus' },
    { question: 'Kuidas toimub metsa müük oksjonil?', answer: 'Metsa müük oksjonil algab metsa hindamisega. Pärast hindamist pannakse mets oksjonile ja parim pakkumine võidab.', categorySlug: 'metsandus', order: 3, slug: 'metsa-muuk-oksjonil' },
    { question: 'Mis metsa liike saab oksjonil müüa?', answer: 'Oksjonil saab müüa raieõigust, metsamaad, kinnistuid, kiiret raieõigust ja pakette.', categorySlug: 'metsandus', order: 4, slug: 'metsa-liigid' },

    { question: 'Milline on lepingu sõlmimise protsess?', answer: 'Pärast oksjoni lõppu saadab Erametsad võitjale ja müüjale lepingu allkirjastamiseks. Leping allkirjastatakse digitaalselt.', categorySlug: 'oigus', order: 1, slug: 'lepingu-protsess' },
    { question: 'Kas lepingud on juriidiliselt siduvad?', answer: 'Kõik digitaalselt allkirjastatud lepingud on Eesti seaduste kohaselt juriidiliselt siduvad.', categorySlug: 'oigus', order: 2, slug: 'leping-siduvus' },
    { question: 'Kuidas lahendatakse vaidlusi?', answer: 'Vaidluste korral soovitame esmalt pöörduda Erametsade klienditoe poole. Vajadusel lahendatakse vaidlused kohtuväliselt või kohtus.', categorySlug: 'oigus', order: 3, slug: 'vaidlused' },

    { question: 'Milliseid brausereid toetate?', answer: 'Toetame kõiki kaasaegseid brausereid: Chrome, Firefox, Safari ja Edge uusimaid versioone.', categorySlug: 'tehniline', order: 1, slug: 'brauserid' },
    { question: 'Kas Erametsad töötab mobiilis?', answer: 'Jah, Erametsad on täielikult mobiilisõbralik ja töötab suurepäraselt nii nutitelefonis kui tahvelarvutis.', categorySlug: 'tehniline', order: 2, slug: 'mobiil' },
    { question: 'Kuidas eID autentimine töötab?', answer: 'eID autentimine toimub Smart-ID, Mobile-ID või ID-kaardi abil. Vali sisselogimisel sobiv viis ja järgi ekraanil kuvatavaid juhiseid.', categorySlug: 'tehniline', order: 3, slug: 'eid' },

    { question: 'Kuidas võtta ühendust klienditoega?', answer: 'Klienditoega saab ühendust e-posti teel info@eametsad.ee või telefoni teel +372 6000 000.', categorySlug: 'kontakt', order: 1, slug: 'klienditugi' },
    { question: 'Kus asub teie kontor?', answer: 'Meie kontor asub Tallinnas, aadressil Toompuiestee 35, 10149 Tallinn.', categorySlug: 'kontakt', order: 2, slug: 'kontori-aadress' },
    { question: 'Millal on klienditugi avatud?', answer: 'Klienditugi on avatud E-R 9:00-17:00. Kiireloomulistes küsimustes võta ühendust e-posti teel.', categorySlug: 'kontakt', order: 3, slug: 'tooaeg' },
  ]

  for (const item of FAQ_ITEMS) {
    const cat = categoryDocs[item.categorySlug]
    if (!cat) continue
    await payload.create({
      collection: 'faq-items',
      data: {
        question: item.question,
        answer: rt(item.answer),
        category: cat.id,
        order: item.order,
        slug: item.slug,
      },
    })
  }

  // ── ARTICLES ──
  const ARTICLES: { title: string; slug: string; excerpt: string; content: string; author: string; tags: string[] }[] = [
    {
      title: 'Kuidas metsa oksjonil müüa?',
      slug: 'kuidas-metsa-oksjonil-muua',
      excerpt: 'Samm-sammult juhend metsa müügiks oksjonikeskkonnas.',
      content: 'Metsa müük oksjonil on lihtne protsess, mis koosneb neljast sammust: 1) kontakteeru meiega, 2) telli metsa hinnang, 3) pane mets oksjonile, 4) sõlmi leping parima pakkujaga.',
      author: 'Erametsad',
      tags: ['müük', 'oksjon'],
    },
    {
      title: 'Metsa hindamise juhend metsaomanikule',
      slug: 'metsa-hindamise-juhend',
      excerpt: 'Kuidas hinnata oma metsa väärtust ja millest sõltub hind.',
      content: 'Metsa hind sõltub paljudest teguritest: puistu liigiline koosseis, vanus, tüsedus, asukoht, raieõiguse tüüp ja kehtivad metsanduslikud piirangud.',
      author: 'Mari Maasikas',
      tags: ['hindamine', 'metsandus'],
    },
    {
      title: 'Automaatpakkumise eelised oksjonil',
      slug: 'automaatpakkumise-eelised',
      excerpt: 'Säästa aega ja alati parim pakkumine.',
      content: 'Automaatpakkumine võimaldab määrata maksimaalse summa, mille oled nõus maksma. Süsteem tõstab sinu pakkumist automaatselt vastavalt vajadusele.',
      author: 'Erametsad',
      tags: ['autobidder', 'pakkumine'],
    },
    {
      title: 'Säästva metsamajanduse põhimõtted',
      slug: 'saastva-metsamajanduse-pohimotted',
      excerpt: 'Kuidas majandada metsa säästvalt ja jätkusuutlikult.',
      content: 'Säästva metsamajanduse eesmärk on tagada metsade püsimine, bioloogiline mitmekesisus ja majanduslik jätkusuutlikkus põlvest põlve.',
      author: 'Peeter Põder',
      tags: ['säästev', 'metsandus'],
    },
    {
      title: 'Oksjoni tingimused ja reeglid',
      slug: 'oksjoni-tingimused-ja-reeglid',
      excerpt: 'Tutvu oksjoni täpsete tingimuste ja reeglitega.',
      content: 'Kõik oksjonid toimuvad vastavalt Erametsade üldtingimustele, mis on kättesaadavad meie lehel. Soovitame tutvuda enne esimese pakkumise tegemist.',
      author: 'Erametsad',
      tags: ['reeglid', 'tingimused'],
    },
    {
      title: 'Korduma kippuvad küsimused eID kohta',
      slug: 'kkk-eid',
      excerpt: 'Vastused levinud küsimustele elektroonilise identiteedi kohta.',
      content: 'eID (elektrooniline identiteet) võimaldab turvalist sisselogimist ja allkirjastamist. Toetame Smart-ID, Mobile-ID ja ID-kaarti.',
      author: 'Erametsad',
      tags: ['eid', 'tehniline'],
    },
  ]

  for (const article of ARTICLES) {
    await payload.create({
      collection: 'articles',
      data: {
        ...article,
        content: rt(article.content),
        status: 'published',
        publishedAt: new Date(),
      },
    })
  }

  // ── TESTIMONIALS ──
  const TESTIMONIALS: { name: string; role: string; content: string; featured: boolean }[] = [
    { name: 'Mati Mets', role: 'Metsaomanik', content: 'Erametsad aitas mul müüa oma metsa parima hinnaga. Protsess oli lihtne ja läbipaistev.', featured: true },
    { name: 'Kadri Kask', role: 'Metsaspetsialist', content: 'Platvorm on kasutajasõbralik ja pakub suurepärast ülevaadet metsaoksjonitest.', featured: true },
    { name: 'Jaan Jõgi', role: 'Ostja', content: 'Leidsin Erametsade kaudu suurepärase raieõiguse. Soovitan kõigile metsaostjatele.', featured: false },
    { name: 'Malle Mänd', role: 'Metsaomanik', content: 'Müüsin oksjoni kaudu kaks kinnistut. Mõlemad läksid oodatust kõrgema hinnaga.', featured: true },
  ]

  for (const t of TESTIMONIALS) {
    await payload.create({
      collection: 'testimonials',
      data: t,
    })
  }

  // ── LEGAL DOCUMENTS ──
  const LEGAL_DOCS: { title: string; slug: string; type: string; content: string; version: string; effectiveDate: Date }[] = [
    {
      title: 'Kasutustingimused',
      slug: 'kasutustingimused',
      type: 'terms',
      content: 'Erametsad.ee kasutustingimused reguleerivad platvormi kasutamist. Platvormi kasutades nõustud käesolevate tingimustega. Erametsad OÜ pakub oksjonikeskkonda metsavara ostmiseks ja müümiseks.',
      version: '1.0',
      effectiveDate: new Date('2025-01-01'),
    },
    {
      title: 'Privaatsuspoliitika',
      slug: 'privaatsuspoliitika',
      type: 'privacy',
      content: 'Privaatsuspoliitika kirjeldab, kuidas kogume, töötleme ja säilitame isikuandmeid. Isikuandmeid töödeldakse vastavalt isikuandmete kaitse seadusele ja Euroopa andmekaitsemäärusele (GDPR).',
      version: '1.0',
      effectiveDate: new Date('2025-01-01'),
    },
    {
      title: 'Küpsiste poliitika',
      slug: 'kupsiste-poliitika',
      type: 'cookies',
      content: 'Erametsad kasutab küpsiseid veebilehe toimimiseks, kasutajakogemuse parandamiseks ja statistika kogumiseks. Vajalikud küpsised on kohustuslikud, statistilised küpsised võid keelata.',
      version: '1.0',
      effectiveDate: new Date('2025-01-01'),
    },
  ]

  for (const doc of LEGAL_DOCS) {
    await payload.create({
      collection: 'legal-documents',
      data: {
        ...doc,
        content: rt(doc.content),
        publishedAt: new Date(),
      },
    })
  }

  console.log(`Seeded 1 homepage, ${String(services.length)} service pages, ${String(FAQ_CATEGORIES.length)} FAQ categories, ${String(FAQ_ITEMS.length)} FAQ items, ${String(ARTICLES.length)} articles, ${String(TESTIMONIALS.length)} testimonials, ${String(LEGAL_DOCS.length)} legal documents`)
}
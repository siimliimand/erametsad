/* eslint-disable no-console */
import type { Payload } from 'payload'

const SPECIALISTS: {
  name: string
  slug: string
  role: string
  phone: string
  email: string
  bio: unknown
  region: string
  active: boolean
  featured: boolean
}[] = [
  {
    name: 'Mari Maasikas',
    slug: 'mari-maasikas',
    role: 'metsaspetsialist',
    phone: '+372 5000 0001',
    email: 'mari.maasikas@eametsad.ee',
    bio: {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [{ text: 'Mari on kogenud metsaspetsialist, kes on spetsialiseerunud metsade hindamisele ja majandamisele. Tal on üle 15 aasta kogemust Eesti metsanduses.' }],
          },
        ],
      },
    },
    region: 'Tartu',
    active: true,
    featured: true,
  },
  {
    name: 'Jaan Jänes',
    slug: 'jaan-janes',
    role: 'metsakonsultant',
    phone: '+372 5000 0002',
    email: 'jaan.janes@eametsad.ee',
    bio: {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [{ text: 'Jaan pakub professionaalset metsakonsultatsiooni ja nõustab metsaomanikke säästva metsamajanduse küsimustes.' }],
          },
        ],
      },
    },
    region: 'Harju',
    active: true,
    featured: false,
  },
  {
    name: 'Kati Karu',
    slug: 'kati-karu',
    role: 'metsaspetsialist',
    phone: '+372 5000 0003',
    email: 'kati.karu@eametsad.ee',
    bio: {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [{ text: 'Kati on spetsialiseerunud looduskaitseliste metsade hindamisele ja metsaökosüsteemide uuringutele.' }],
          },
        ],
      },
    },
    region: 'Pärnu',
    active: true,
    featured: true,
  },
  {
    name: 'Peeter Põder',
    slug: 'peeter-poder',
    role: 'metsakonsultant',
    phone: '+372 5000 0004',
    email: 'peeter.poder@eametsad.ee',
    bio: {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [{ text: 'Peeter on pikaajalise kogemusega metsakonsultant, kes abistab metsaoksjonite ettevalmistamisel ja läbiviimisel.' }],
          },
        ],
      },
    },
    region: 'Võru',
    active: true,
    featured: false,
  },
  {
    name: 'Liisa Lõoke',
    slug: 'liisa-looke',
    role: 'metsaspetsialist',
    phone: '+372 5000 0005',
    email: 'liisa.looke@eametsad.ee',
    bio: {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [{ text: 'Liisa tegeleb metsade inventeerimise ja kasutusõiguse hindamisega, pakkudes metsaomanikele parimaid lahendusi.' }],
          },
        ],
      },
    },
    region: 'Saare',
    active: true,
    featured: false,
  },
  {
    name: 'Tõnu Tamm',
    slug: 'tonu-tamm',
    role: 'metsaspetsialist',
    phone: '+372 5000 0006',
    email: 'tonu.tamm@eametsad.ee',
    bio: {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [{ text: 'Tõnu on metsandusekspert, kes on juhtinud arvukalt metsaoksjoneid ja nõustanud nii ostjaid kui müüjaid.' }],
          },
        ],
      },
    },
    region: 'Lääne-Viru',
    active: false,
    featured: false,
  },
]

export async function seedSpecialists(payload: Payload): Promise<void> {
  const existing = await payload.find({ collection: 'specialist', limit: 1 })
  if (existing.totalDocs > 0) {
    console.log('Specialists already seeded, skipping')
    return
  }

  for (const s of SPECIALISTS) {
    await payload.create({
      collection: 'specialist',
      data: s,
    })
  }

  console.log(`Seeded ${String(SPECIALISTS.length)} specialists`)
}
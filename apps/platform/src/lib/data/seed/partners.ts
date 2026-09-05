/* eslint-disable no-console */
import type { CoreRepositories } from '../repositories'

interface SeedPartner {
  name: string
  serviceTypes: string[]
  /** County codes from the county seed; null means every county. */
  counties: string[] | null
  capacity: number
  contactEmail: string
  contactPhone: string
  active: boolean
}

// Demo partners for the hub counts and the admin routing screen. Two or three
// per service type across demo counties; exactly one inactive partner.
const PARTNERS: SeedPartner[] = [
  // Metsamajanduskava
  {
    name: 'Metsapluss OÜ',
    serviceTypes: ['kava'],
    counties: ['HH', 'RA'],
    capacity: 8,
    contactEmail: 'info@metsapluss.ee',
    contactPhone: '+37251000101',
    active: true,
  },
  {
    name: 'Silva Konsult OÜ',
    serviceTypes: ['kava'],
    counties: ['TA', 'PR'],
    capacity: 6,
    contactEmail: 'kontakt@silvakonsult.ee',
    contactPhone: '+37251000102',
    active: true,
  },
  {
    name: 'Läänemetsa Kava OÜ',
    serviceTypes: ['kava'],
    counties: null,
    capacity: 4,
    contactEmail: 'info@laanemetsakava.ee',
    contactPhone: '+37251000103',
    active: true,
  },

  // Hooldusraie
  {
    name: 'Raiejõud OÜ',
    serviceTypes: ['hooldusraie'],
    counties: ['HH', 'LV'],
    capacity: 12,
    contactEmail: 'info@raiejoud.ee',
    contactPhone: '+37251000201',
    active: true,
  },
  {
    name: 'Metsameister OÜ',
    serviceTypes: ['hooldusraie'],
    counties: ['TA', 'PL', 'VO'],
    capacity: 10,
    contactEmail: 'info@metsameister.ee',
    contactPhone: '+37251000202',
    active: true,
  },
  {
    name: 'Pärnu Puuteenus OÜ',
    serviceTypes: ['hooldusraie'],
    counties: ['PR', 'VR'],
    capacity: 8,
    contactEmail: 'info@puuteenus.ee',
    contactPhone: '+37251000203',
    active: false,
  },

  // Istutamine
  {
    name: 'Istikutehas OÜ',
    serviceTypes: ['istutamine'],
    counties: ['TA', 'JG'],
    capacity: 20,
    contactEmail: 'info@istikutehas.ee',
    contactPhone: '+37251000301',
    active: true,
  },
  {
    name: 'Roheline Alus OÜ',
    serviceTypes: ['istutamine'],
    counties: ['HH', 'LN'],
    capacity: 15,
    contactEmail: 'info@rohelinealus.ee',
    contactPhone: '+37251000302',
    active: true,
  },
  {
    name: 'Viljandi Istutaja OÜ',
    serviceTypes: ['istutamine'],
    counties: ['VR', 'VG'],
    capacity: 12,
    contactEmail: 'info@viljandiistutaja.ee',
    contactPhone: '+37251000303',
    active: true,
  },
]

export async function seedPartners(repos: CoreRepositories): Promise<void> {
  const existing = await repos.find({ collection: 'partners', limit: 1 })
  if (existing.docs.length > 0) {
    console.log('Partners already seeded, skipping')
    return
  }

  for (const partner of PARTNERS) {
    await repos.create({ collection: 'partners', data: partner })
  }

  console.log(`Seeded ${String(PARTNERS.length)} partners`)
}

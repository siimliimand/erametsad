/* eslint-disable no-console */
import type { CoreRepositories } from '../repositories'

interface SeedServiceRequest {
  type: 'kava' | 'hooldusraie' | 'istutamine'
  payload: Record<string, unknown>
  status: 'new' | 'routed'
  /** Partner names resolved against the seeded partners; empty for new requests. */
  routedPartnerNames?: string[]
  consentAt: string
  formName: 'metsamajanduskava-1' | 'hooldusraie-1' | 'metsa-istutamine-1'
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString()
}

// Covers every request type with one new and one routed entry; routed entries
// reference the partners seeded by seedPartners.
const SERVICE_REQUESTS: SeedServiceRequest[] = [
  {
    type: 'kava',
    payload: {
      type: 'kava',
      contact: { name: 'Kadri Kask', phone: '+37251110001', email: 'kadri.kask@meil.ee' },
      cadastres: ['12301:001:0020', '65308:002:0115'],
      paper_copy: true,
      comment: 'Palun pakkumus umbes 12 hektari majanduskavale.',
    },
    status: 'new',
    consentAt: daysAgo(6),
    formName: 'metsamajanduskava-1',
  },
  {
    type: 'kava',
    payload: {
      type: 'kava',
      contact: { name: 'Jaan Mets', phone: '+37251110002', email: 'jaan.mets@meil.ee' },
      cadastres: ['65301:002:0010'],
      paper_copy: false,
    },
    status: 'routed',
    routedPartnerNames: ['Metsapluss OÜ', 'Silva Konsult OÜ'],
    consentAt: daysAgo(9),
    formName: 'metsamajanduskava-1',
  },
  {
    type: 'hooldusraie',
    payload: {
      type: 'hooldusraie',
      contact: { name: 'Piret Põld', phone: '+37251110003', email: 'piret.pold@meil.ee' },
      county: 'RA',
      cadastres: ['78402:003:0210'],
      provisions: 'Harvendus 60-aastases kuusikus, juurdepääs põlluteelt.',
      services: ['hooldamine'],
      comment: 'Töö võib toimuda ka talvel.',
    },
    status: 'new',
    consentAt: daysAgo(4),
    formName: 'hooldusraie-1',
  },
  {
    type: 'hooldusraie',
    payload: {
      type: 'hooldusraie',
      contact: { name: 'Mihkel Saar', phone: '+37251110004', email: 'mihkel.saar@meil.ee' },
      county: 'HH',
      cadastres: ['12102:004:0355', '12102:004:0356'],
      provisions: 'Valgusraie kõrval, täiendav hooldus teeservadel.',
      services: ['hooldamine', 'valgusraie'],
    },
    status: 'routed',
    routedPartnerNames: ['Raiejõud OÜ'],
    consentAt: daysAgo(11),
    formName: 'hooldusraie-1',
  },
  {
    type: 'istutamine',
    payload: {
      type: 'istutamine',
      contact: { name: 'Anu Rebane', phone: '+37251110005', email: 'anu.rebane@meil.ee' },
      county: 'TA',
      cadastres: ['77201:002:0044'],
      provisions: 'Mahajäetud põllumaa metsastamine, 4 hektarit.',
      services: ['maapinna_ettevalmistus', 'istutamine'],
      comment: 'Eelistaks kuuseistikuid.',
    },
    status: 'new',
    consentAt: daysAgo(3),
    formName: 'metsa-istutamine-1',
  },
  {
    type: 'istutamine',
    payload: {
      type: 'istutamine',
      contact: { name: 'Toomas Lepp', phone: '+37251110006', email: 'toomas.lepp@meil.ee' },
      county: 'PR',
      cadastres: ['59402:001:0087'],
      provisions: 'Männi istutus 2 hektarile, istikud omaniku tellitavad.',
      services: ['istikud', 'istutamine'],
    },
    status: 'routed',
    routedPartnerNames: ['Istikutehas OÜ'],
    consentAt: daysAgo(8),
    formName: 'metsa-istutamine-1',
  },
]

export async function seedServiceRequests(repos: CoreRepositories): Promise<void> {
  const existing = await repos.find({ collection: 'service-requests', limit: 1 })
  if (existing.docs.length > 0) {
    console.log('Service requests already seeded, skipping')
    return
  }

  const { docs: partners } = await repos.find({ collection: 'partners', pagination: false })
  const partnerIdByName = new Map(partners.map((partner) => [partner.name, partner.id]))

  let routedCount = 0
  for (const request of SERVICE_REQUESTS) {
    const routedTo = (request.routedPartnerNames ?? [])
      .map((name) => partnerIdByName.get(name))
      .filter((id): id is string => id !== undefined)
    if (request.routedPartnerNames?.length !== routedTo.length) {
      console.warn(
        `Skipping unknown partner names for "${request.type}" request: expected ${String(request.routedPartnerNames?.length)}, resolved ${String(routedTo.length)}`,
      )
    }
    if (routedTo.length > 0) {
      routedCount += 1
    }

    await repos.create({
      collection: 'service-requests',
      data: {
        type: request.type,
        payload: request.payload,
        status: request.status,
        ...(routedTo.length > 0 ? { routedTo } : {}),
        consentAt: request.consentAt,
        formName: request.formName,
      },
    })
  }

  console.log(`Seeded ${String(SERVICE_REQUESTS.length)} service requests (${String(routedCount)} routed)`)
}

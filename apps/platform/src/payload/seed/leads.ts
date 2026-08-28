/* eslint-disable no-console */
import type { Payload } from 'payload'

export async function seedLeads(payload: Payload): Promise<void> {
  const existing = await payload.find({ collection: 'leads', limit: 1 })
  if (existing.totalDocs > 0) {
    console.log('Leads already seeded, skipping')
    return
  }

  const { docs: specialists } = await payload.find({ collection: 'specialist', limit: 10 })

  const specialist = specialists[0] ?? undefined

  await payload.create({
    collection: 'leads',
    data: {
      formName: 'Metsa hindamine',
      pageSlug: '/metsa-hindamine',
      contactName: 'Mati Maasikas',
      phone: '+372 5111 0001',
      email: 'mati@example.com',
      cadastr: '12301:001:0020',
      consentAt: new Date(Date.now() - 14 * 86400000),
      source: 'organic',
      status: 'new',
      internalComment: 'Soovib hinnangut Rapla metsale.',
    },
  })

  await payload.create({
    collection: 'leads',
    data: {
      formName: 'Metsa müük',
      pageSlug: '/metsa-muuk',
      contactName: 'Kalle Kuusk',
      phone: '+372 5222 0002',
      email: 'kalle@example.com',
      cadastr: '65301:002:0010',
      consentAt: new Date(Date.now() - 10 * 86400000),
      source: 'facebook',
      status: 'contacted',
      assignedSpecialist: specialist?.id ?? undefined,
      internalComment: 'Helistatud, ootab pakkumist.',
    },
  })

  await payload.create({
    collection: 'leads',
    data: {
      formName: 'Metsa hindamine',
      pageSlug: '/metsa-hindamine',
      contactName: 'Linda Leht',
      phone: '+372 5333 0003',
      email: 'linda@example.com',
      consentAt: new Date(Date.now() - 7 * 86400000),
      source: 'referral',
      status: 'qualified',
      assignedSpecialist: specialist?.id ?? undefined,
      internalComment: 'Mets hindamisel, ootame tulemusi.',
    },
  })

  await payload.create({
    collection: 'leads',
    data: {
      formName: 'Metsa müük',
      pageSlug: '/metsa-muuk',
      contactName: 'Olavi Oks',
      phone: '+372 5444 0004',
      email: 'olavi@example.com',
      consentAt: new Date(Date.now() - 5 * 86400000),
      source: 'google',
      status: 'contract',
      assignedSpecialist: specialist?.id ?? undefined,
      internalComment: 'Leping ettevalmistamisel.',
    },
  })

  await payload.create({
    collection: 'leads',
    data: {
      formName: 'Metsa hooldus',
      pageSlug: '/metsa-hooldus',
      contactName: 'Peeter Purakas',
      phone: '+372 5555 0005',
      email: 'peeter@example.com',
      consentAt: new Date(Date.now() - 20 * 86400000),
      source: 'organic',
      status: 'disqualified',
      internalComment: 'Pole huvitatud, soovis ainult infot.',
    },
  })

  await payload.create({
    collection: 'leads',
    data: {
      formName: 'Kontakt',
      pageSlug: '/kontakt',
      contactName: 'Sirje Sanglepp',
      phone: '+372 5666 0006',
      email: 'sirje@example.com',
      consentAt: new Date(Date.now() - 3 * 86400000),
      source: 'direct',
      status: 'new',
      internalComment: 'Küsis oksjoni kohta, edastada infopakk.',
    },
  })

  console.log('Seeded 6 leads')
}
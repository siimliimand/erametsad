// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ServiceRequestsPage from '../page'

import type { CoreRepositories } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'

const state = vi.hoisted((): {
  session: { userId: string; role: string }
  repositories: unknown
} => ({
  session: { userId: 'admin-1', role: 'admin' },
  repositories: null,
}))

vi.mock('next/link', () => ({
  default: (props: { href: string; children?: ReactNode }) =>
    createElement('a', { href: props.href }, props.children),
}))

vi.mock('../../../_actions/ops', () => ({
  forwardServiceRequestAction: vi.fn(),
  markRequestRespondedAction: vi.fn(),
  retryRequestForwardAction: vi.fn(),
}))

vi.mock('../../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: state.session, repositories: state.repositories }),
  ),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

const getRepositoriesMock = vi.mocked(getRepositories)

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

interface RequestDoc {
  id: string
  type: 'kava' | 'hooldusraie' | 'istutamine'
  status: 'new' | 'routed'
  createdAt: string
  updatedAt: string
  payload: Record<string, unknown>
  routedTo: string[]
  attachments: string[]
  consentAt: string
  pageSlug: string | null
}

interface PartnerDoc {
  id: string
  name: string
  capacity: number
  contactEmail: string | null
  serviceTypes: string[]
  counties: string[] | null
  active: boolean
}

interface AuditDoc {
  id: string
  action: string
  createdAt: string
  entityType: string
  entityId: string | null
  after: Record<string, unknown>
}

const DAY_MS = 24 * 3600 * 1000

function daysAgoAt(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

const partners: PartnerDoc[] = [
  {
    id: 'p1',
    name: 'Metsapartner OÜ',
    capacity: 5,
    contactEmail: 'partner@meil.ee',
    serviceTypes: ['kava', 'hooldusraie'],
    counties: ['HH'],
    active: true,
  },
  {
    id: 'p2',
    name: 'Kogu Eesti Mets',
    capacity: 2,
    contactEmail: 'kogu@meil.ee',
    serviceTypes: ['kava'],
    counties: null,
    active: true,
  },
]

function makeRequest(
  overrides: Partial<RequestDoc> & { id: string; contactName: string },
): RequestDoc {
  const { contactName, ...rest } = overrides
  return {
    type: 'kava',
    status: 'new',
    createdAt: daysAgoAt(10),
    updatedAt: daysAgoAt(9),
    payload: {
      contact: { name: contactName, phone: '+37251110000', email: 'klient@meil.ee' },
      county: 'HH',
      cadastres: ['78402:003:0210'],
    },
    routedTo: [],
    attachments: [],
    consentAt: daysAgoAt(10),
    pageSlug: '/metsamajanduskava',
    ...rest,
  }
}

function makeAudit(
  id: string,
  action: string,
  entityId: string,
  daysAgo: number,
  after: Record<string, unknown>,
): AuditDoc {
  return {
    id,
    action,
    createdAt: daysAgoAt(daysAgo),
    entityType: 'service-request',
    entityId,
    after,
  }
}

function defaultDocs(): Record<string, unknown[]> {
  return {
    'service-requests': [
      makeRequest({
        id: 'req-expired',
        contactName: 'Priit Põhjamets',
        status: 'routed',
        routedTo: ['p1'],
        updatedAt: daysAgoAt(9),
      }),
      makeRequest({
        id: 'req-approaching',
        contactName: 'Anu Kask',
        status: 'routed',
        routedTo: ['p2'],
        updatedAt: daysAgoAt(6),
      }),
      makeRequest({
        id: 'req-answered',
        contactName: 'Mati Tamm',
        status: 'routed',
        routedTo: ['p1', 'p2'],
        updatedAt: daysAgoAt(2),
      }),
      makeRequest({ id: 'req-new', contactName: 'Eve Lind', updatedAt: daysAgoAt(1) }),
    ],
    partners,
    'audit-entry': [
      makeAudit('a1', 'request.forward', 'req-expired', 9, {
        partnerId: 'p1',
        partnerName: 'Metsapartner OÜ',
        recipient: 'partner@meil.ee',
        emailResult: { success: true },
      }),
      makeAudit('a2', 'request.forward', 'req-approaching', 6, {
        partnerId: 'p2',
        partnerName: 'Kogu Eesti Mets',
        recipient: 'kogu@meil.ee',
        emailResult: { success: true },
      }),
      makeAudit('a3', 'request.forward', 'req-answered', 2, {
        partnerId: 'p1',
        partnerName: 'Metsapartner OÜ',
        recipient: 'partner@meil.ee',
        emailResult: { success: true },
      }),
      makeAudit('a4', 'request.mark_responded', 'req-answered', 1, {
        partnerId: 'p1',
      }),
    ],
  }
}

function useDocs(docs: Record<string, unknown[]>): void {
  const repositories = {
    find: vi.fn((args: { collection: string }) =>
      Promise.resolve({ docs: docs[args.collection] ?? [] })),
  }
  state.repositories = repositories
  getRepositoriesMock.mockResolvedValue(repositories as unknown as CoreRepositories)
}

let container: HTMLDivElement
let root: Root

async function mountPage(searchParams: Record<string, string> = {}): Promise<void> {
  const element = await ServiceRequestsPage({
    searchParams: Promise.resolve(searchParams),
  })
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(element)
    await Promise.resolve()
  })
}

async function unmountPage(): Promise<void> {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.remove()
}

beforeEach(() => {
  state.session = { userId: 'admin-1', role: 'admin' }
  useDocs(defaultDocs())
})

afterEach(async () => {
  await unmountPage()
  getRepositoriesMock.mockReset()
})

function infoStripText(): string {
  const strip = container.querySelector('.border-l-info')
  if (strip === null) throw new Error('7-day-rule info strip not found')
  return strip.textContent
}

function mainTableRows(): HTMLTableRowElement[] {
  const table = container.querySelector('table')
  if (table === null) throw new Error('request table not found')
  return [...table.querySelectorAll<HTMLTableRowElement>('tbody tr')]
}

function rowByClient(name: string): HTMLTableRowElement {
  const row = mainTableRows().find((candidate) =>
    candidate.textContent.includes(name),
  )
  if (row === undefined) throw new Error(`row for "${name}" not found`)
  return row
}

function trackingSection(): HTMLElement {
  const heading = [...container.querySelectorAll('h3')].find(
    (candidate) => candidate.textContent === 'Vastuste jälgimine',
  )
  if (heading === undefined) throw new Error('response tracking section not found')
  const section = heading.parentElement
  if (section === null) throw new Error('response tracking body not found')
  return section
}

function trackingRowText(index: number): string {
  const body = trackingSection().querySelector('tbody')
  if (body === null) throw new Error('response tracking table not found')
  const row = body.querySelectorAll('tr')[index]
  if (row === undefined) throw new Error(`tracking row ${String(index)} not found`)
  return row.textContent
}

describe('requests list 7-day-rule strip', () => {
  it('announces the window and a calm queue when nothing is near the deadline', async () => {
    useDocs({
      'service-requests': [
        makeRequest({ id: 'req-new', contactName: 'Eve Lind', updatedAt: daysAgoAt(1) }),
        makeRequest({
          id: 'req-answered',
          contactName: 'Mati Tamm',
          status: 'routed',
          routedTo: ['p1'],
          updatedAt: daysAgoAt(2),
        }),
      ],
      partners,
      'audit-entry': [
        makeAudit('a3', 'request.forward', 'req-answered', 2, {
          partnerId: 'p1',
          partnerName: 'Metsapartner OÜ',
          emailResult: { success: true },
        }),
        makeAudit('a4', 'request.mark_responded', 'req-answered', 1, {
          partnerId: 'p1',
        }),
      ],
    })
    await mountPage()

    const strip = infoStripText()
    expect(strip).toContain('Pakkujad vastavad 7 päeva jooksul edastamisest.')
    expect(strip).toContain('Ükski aktiivne päring ei ole veel tähtaega lähedas.')
  })

  it('counts approaching and expired requests in the strip', async () => {
    await mountPage()

    const strip = infoStripText()
    expect(strip).toMatch(/Tähtaeg lähedas:\s*1/)
    expect(strip).toMatch(/Tähtaeg ületatud:\s*1/)
    expect(strip).not.toContain('Ükski aktiivne päring')
  })
})

describe('requests list states and expired tint', () => {
  it('tints expired rows and labels new, sent, answered and expired states', async () => {
    await mountPage()

    const expired = rowByClient('Priit Põhjamets')
    expect(expired.className).toContain('bg-dangerLight')
    expect(expired.textContent).toContain('aegunud')

    const approaching = rowByClient('Anu Kask')
    expect(approaching.className).not.toContain('bg-dangerLight')
    expect(approaching.textContent).toContain('saadetud')

    expect(rowByClient('Mati Tamm').textContent).toContain('vastatud (1)')
    expect(rowByClient('Eve Lind').textContent).toContain('uus')
  })
})

describe('routing drawer response tracking', () => {
  it('shows answered and still-waiting partner rows', async () => {
    await mountPage({ detail: 'req-answered' })

    expect(trackingRowText(0)).toContain('Metsapartner OÜ')
    expect(trackingRowText(0)).toContain('Vastas')
    expect(trackingRowText(1)).toContain('Kogu Eesti Mets')
    expect(trackingRowText(1)).toContain('Ootab vastust')
  })

  it('marks an unanswered partner as expired after seven days', async () => {
    await mountPage({ detail: 'req-expired' })

    expect(trackingRowText(0)).toContain('Metsapartner OÜ')
    expect(trackingRowText(0)).toContain('Ei vastanud — 7 päeva möödus')
  })

  it('tells the tracker when a request was never routed', async () => {
    await mountPage({ detail: 'req-new' })

    expect(trackingSection().textContent).toContain(
      'Päring ei ole veel pakkujatele edastatud.',
    )
    expect(trackingSection().querySelector('tbody')).toBeNull()
  })
})

describe('requests list role gating', () => {
  it('hides the list from roles without inquiry read rights', async () => {
    state.session = { userId: 'seller-1', role: 'seller' }
    await mountPage()

    expect(container.textContent).toContain('Ainult administraatorile ja spetsialistidele.')
    expect(container.querySelector('table')).toBeNull()
  })
})

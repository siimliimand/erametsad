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
  markRequestDoneAction: vi.fn(),
  closeRequestAction: vi.fn(),
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
  status: 'new' | 'routed' | 'teostatud' | 'suletud'
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

describe('masked client names and preview columns (task 8.5)', () => {
  it('masks client names in the table but keeps the full name in the detail panel', async () => {
    await mountPage({ detail: 'req-new' })

    expect(rowByClient('Eve L.').textContent).toContain('Eve L.')
    expect(mainTableRows().map((row) => row.textContent)).not.toContain('Eve Lind')
    expect(container.textContent).toContain('Eve Lind')
  })

  it('previews the payload content and counts attachments with a ZIP link', async () => {
    useDocs({
      'service-requests': [
        makeRequest({
          id: 'req-att',
          contactName: 'Eve Lind',
          payload: {
            contact: { name: 'Eve Lind' },
            county: 'HH',
            comment: 'Palun pakkumine võimalikult peaegu.',
            cadastres: ['78402:003:0210'],
          },
          attachments: ['service-requests/1-plaan.pdf', 'service-requests/2-kaart.png'],
        }),
      ],
      partners,
      'audit-entry': [],
    })
    await mountPage()

    const row = rowByClient('Eve L.')
    expect(row.textContent).toContain('Palun pakkumine võimalikult peaegu.')
    expect(row.textContent).toContain('2 · ZIP')
    const zipLink = row.querySelector('a[href^="/admin/inquiries/attachments-zip"]')
    expect(zipLink?.getAttribute('href')).toBe(
      '/admin/inquiries/attachments-zip?paaring=req-att',
    )
  })

  it('shows a dash when the payload carries no previewable content', async () => {
    useDocs({
      'service-requests': [
        makeRequest({
          id: 'req-empty',
          contactName: 'Eve Lind',
          payload: { contact: { name: 'Eve Lind' } },
        }),
      ],
      partners,
      'audit-entry': [],
    })
    await mountPage()

    expect(rowByClient('Eve L.').textContent).toContain('—')
  })
})

describe('list filters (task 8.5)', () => {
  const docs = (): Record<string, unknown[]> => ({
    'service-requests': [
      makeRequest({
        id: 'req-harju',
        contactName: 'Eve Lind',
        createdAt: '2026-03-01T10:00:00.000Z',
        payload: {
          contact: { name: 'Eve Lind' },
          county: 'HH',
          cadastres: ['78402:003:0210'],
        },
      }),
      makeRequest({
        id: 'req-tartu',
        contactName: 'Mati Tamm',
        createdAt: '2026-04-11T10:00:00.000Z',
        payload: {
          contact: { name: 'Mati Tamm' },
          county: 'TA',
          cadastres: ['78904:101:0123'],
        },
      }),
    ],
    partners,
    'audit-entry': [],
  })

  it('filters by county from the payload', async () => {
    useDocs(docs())
    await mountPage({ maakond: 'TA' })

    expect(mainTableRows()).toHaveLength(1)
    expect(rowByClient('Mati T.').textContent).toContain('Tartu')
  })

  it('filters by the created date', async () => {
    useDocs(docs())
    await mountPage({ kuupaev: '2026-03-01' })

    expect(mainTableRows()).toHaveLength(1)
    expect(rowByClient('Eve L.').textContent).toContain('Harju')
  })

  it('searches free text over name and cadastres', async () => {
    useDocs(docs())
    await mountPage({ otsing: '78904' })

    expect(mainTableRows()).toHaveLength(1)
    expect(rowByClient('Mati T.').textContent).toContain('Tartu')
  })
})

describe('done and close row actions (task 8.4)', () => {
  const docs = (): Record<string, unknown[]> => ({
    'service-requests': [
      makeRequest({ id: 'req-active', contactName: 'Eve Lind' }),
      makeRequest({
        id: 'req-done',
        contactName: 'Mati Tamm',
        status: 'teostatud',
      }),
      makeRequest({
        id: 'req-closed',
        contactName: 'Anu Kask',
        status: 'suletud',
      }),
    ],
    partners,
    'audit-entry': [],
  })

  it('offers Märgi teostatuks and Sulge only while a request is open', async () => {
    useDocs(docs())
    await mountPage()

    expect(rowByClient('Eve L.').textContent).toContain('Märgi teostatuks')
    expect(rowByClient('Eve L.').textContent).toContain('Sulge')
  })

  it('renders the teostatud and suletud chips with no remaining actions', async () => {
    useDocs(docs())
    await mountPage()

    expect(rowByClient('Mati T.').textContent).toContain('teostatud')
    expect(rowByClient('Mati T.').textContent).not.toContain('Märgi teostatuks')
    expect(rowByClient('Mati T.').textContent).toContain('Sulge')

    expect(rowByClient('Anu K.').textContent).toContain('suletud')
    expect(rowByClient('Anu K.').textContent).not.toContain('Märgi teostatuks')
    expect(rowByClient('Anu K.').textContent).not.toContain('Sulge')
  })

  it('filters by the new statuses', async () => {
    useDocs(docs())
    await mountPage({ olek: 'teostatud' })

    expect(mainTableRows()).toHaveLength(1)
    expect(rowByClient('Mati T.').textContent).toContain('teostatud')
  })
})

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

    const expired = rowByClient('Priit P.')
    expect(expired.className).toContain('bg-dangerLight')
    expect(expired.textContent).toContain('aegunud')

    const approaching = rowByClient('Anu K.')
    expect(approaching.className).not.toContain('bg-dangerLight')
    expect(approaching.textContent).toContain('saadetud')

    expect(rowByClient('Mati T.').textContent).toContain('vastatud (1)')
    expect(rowByClient('Eve L.').textContent).toContain('uus')
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

function forwardLogSection(): HTMLElement {
  const heading = [...container.querySelectorAll('h3')].find(
    (candidate) => candidate.textContent === 'Edastamise log',
  )
  if (heading === undefined) throw new Error('forward log section not found')
  const section = heading.parentElement
  if (section === null) throw new Error('forward log body not found')
  return section
}

function forwardLogRows(): HTMLTableRowElement[] {
  const body = forwardLogSection().querySelector('tbody')
  if (body === null) throw new Error('forward log table not found')
  return [...body.querySelectorAll<HTMLTableRowElement>('tr')]
}

function forwardLogRow(index: number): HTMLTableRowElement {
  const row = forwardLogRows()[index]
  if (row === undefined) throw new Error(`forward log row ${String(index)} not found`)
  return row
}

function forwardLogCell(rowIndex: number, cellIndex: number): HTMLElement {
  const cell = forwardLogRow(rowIndex).querySelectorAll('td')[cellIndex]
  if (cell === undefined) throw new Error(`forward log cell ${String(cellIndex)} not found`)
  return cell
}

describe('forwarding log Vastanud/Märkus/järjekorras columns (task 8.6)', () => {
  it('renders the real response time and the partner note', async () => {
    useDocs({
      'service-requests': [
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
        makeAudit('a1', 'request.forward', 'req-answered', 2, {
          partnerId: 'p1',
          partnerName: 'Metsapartner OÜ',
          recipient: 'partner@meil.ee',
          emailResult: { success: true },
        }),
        makeAudit('a4', 'request.mark_responded', 'req-answered', 1, {
          partnerId: 'p1',
          partnerName: 'Metsapartner OÜ',
          note: 'Hindame ja vastame esmaspäevaks',
        }),
      ],
    })
    await mountPage({ detail: 'req-answered' })

    const headers = [...forwardLogSection().querySelectorAll('th')].map((th) => th.textContent)
    expect(headers).toContain('Vastanud')
    expect(headers).toContain('Märkus')

    const forwardRow = forwardLogRow(0)
    expect(forwardRow.textContent).not.toContain('järjekorras')
    // The Vastanud cell holds a formatted timestamp instead of a dash.
    const vastanudCell = forwardLogCell(0, 3)
    expect(vastanudCell.textContent).not.toBe('—')
    expect(vastanudCell.textContent).toMatch(/\d/)

    expect(forwardLogCell(0, 4).textContent).toBe('Hindame ja vastame esmaspäevaks')
  })

  it('marks delivered but unanswered forwards as järjekorras', async () => {
    await mountPage({ detail: 'req-expired' })

    const row = forwardLogRow(0)
    expect(row.textContent).toContain('järjekorras')
    expect(forwardLogCell(0, 3).textContent).toContain('järjekorras')
    expect(forwardLogCell(0, 4).textContent).toBe('—')
  })

  it('offers a märkus input with the Märgi vastatuks action', async () => {
    await mountPage({ detail: 'req-expired' })

    const noteInput = forwardLogSection().querySelector<HTMLInputElement>(
      'input[name="note"][aria-label="Märkus"]',
    )
    expect(noteInput).not.toBeNull()
    expect(forwardLogSection().textContent).toContain('Märgi vastatuks')
  })
})

describe('preselect count from Seaded (task 8.6)', () => {
  it('preselects fewer partners when the reserved settings key lowers the count', async () => {
    useDocs({
      'service-requests': [
        makeRequest({ id: 'req-new', contactName: 'Eve Lind', updatedAt: daysAgoAt(1) }),
      ],
      partners,
      'audit-entry': [],
      settings: [{ id: 'settings-1', featureFlags: { inquiryRouting: { preselectCount: 1 } } }],
    })
    await mountPage({ detail: 'req-new' })

    const checked = [
      ...container.querySelectorAll<HTMLInputElement>('input[name="partnerIds"]:checked'),
    ]
    const all = [...container.querySelectorAll<HTMLInputElement>('input[name="partnerIds"]')]
    expect(all).toHaveLength(2)
    expect(checked).toHaveLength(1)
  })

  it('keeps the default preselect of 3 without a settings row', async () => {
    await mountPage({ detail: 'req-new' })

    const all = [...container.querySelectorAll<HTMLInputElement>('input[name="partnerIds"]')]
    const checked = all.filter((input) => input.checked)
    expect(all).toHaveLength(2)
    expect(checked).toHaveLength(2)
  })
})

describe('manual e-mail copy fallback (task 8.6)', () => {
  it('offers the rendered e-mail text for copying when no partner matches', async () => {
    useDocs({
      'service-requests': [
        makeRequest({
          id: 'req-new',
          contactName: 'Eve Lind',
          payload: {
            contact: { name: 'Eve Lind', phone: '+37251110000', email: 'eve@meil.ee' },
            county: 'HH',
            cadastres: ['78402:003:0210'],
          },
        }),
      ],
      partners: [],
      'audit-entry': [],
    })
    await mountPage({ detail: 'req-new' })

    expect(container.textContent).toContain('Käsitsi saatmine')
    const copyButton = [...container.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === 'Kopeeri e-kirja tekst',
    )
    expect(copyButton).toBeDefined()
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="E-kirja tekst"]')
    expect(textarea?.value).toContain('Erametsa päring: kava')
    expect(textarea?.value).toContain('Kontakt:')
    expect(textarea?.value).toContain('Katastritunnused: 78402:003:0210')
  })

  it('hides the fallback when a partner matches', async () => {
    await mountPage({ detail: 'req-new' })

    expect(container.textContent).not.toContain('Kopeeri e-kirja tekst')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }))

vi.mock('../email-sender', () => ({
  sendEmail: sendEmailMock,
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { EventBus, type DomainEvent } from '../event-bus'
import { startListening } from '../service'

import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import {
  createCoreRepositories,
  createPartnersRepository,
  createServiceRequestsRepository,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import type { SaleSubmission } from '@/lib/object-submission'
import { ingestSaleSubmission } from '@/lib/object-submission/sale-branch'
import { ingestServiceRequest, type ServiceRequestServices } from '@/lib/service-requests/ingestion'

process.env.ISIKUKOOD_ENCRYPTION_KEY = process.env.ISIKUKOOD_ENCRYPTION_KEY ?? 'integration-test-key'
// dispatchEmail reads this per send; empty would fall back to DEFAULT_FROM.
process.env.SMTP_FROM = 'noreply@erametsad.ee'

let testDb: SqliteTestDb
let repos: CoreRepositories
let consoleWarn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  testDb = createSqliteTestDb()
  repos = createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: sqliteBatchRunner(testDb.raw),
  })
  sendEmailMock.mockResolvedValue({ success: true, transport: 'smtp', messageId: '<sub@mailpit>' })
  vi.mocked(getRepositories).mockImplementation(() => Promise.resolve(repos as never))
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  consoleWarn.mockRestore()
  vi.clearAllMocks()
  testDb.close()
})

function notificationRows(event: string): { channel: string | null; user_id: string }[] {
  return testDb.raw
    .prepare('select channel, user_id from notifications where event = ?')
    .all(event) as { channel: string | null; user_id: string }[]
}

describe('submission notifications through the dispatcher', () => {
  it('confirms the submitter on submission.received with an email and in-app rows', async () => {
    await repos.create({ collection: 'users', data: { id: 'u-seller', email: 'seller@example.ee' } })
    const bus = new EventBus()
    startListening(bus)

    bus.emit({
      type: 'submission.received',
      userId: 'u-seller',
      payload: { objectTitle: 'Raieõiguse müük 78402:003:0210' },
    })

    await vi.waitFor(() => {
      expect(notificationRows('submission.received')).toHaveLength(2)
    })
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(sendEmailMock).toHaveBeenCalledWith({
      from: 'noreply@erametsad.ee',
      to: 'seller@example.ee',
      subject: 'Teie pakkumine on meile jõudnud',
      html: expect.stringContaining('Raieõiguse müük 78402:003:0210') as string,
    })
    const rows = notificationRows('submission.received')
    expect(rows.map((row) => row.channel).sort()).toEqual(['email', 'in_app'])
    expect(rows.every((row) => row.user_id === 'u-seller')).toBe(true)
  })

  it('emails the assigned specialist on submission.new without a notifications row', async () => {
    await repos.create({
      collection: 'specialists',
      data: { id: 'sp-mari', name: 'Mari Maasikas', slug: 'sp-mari', email: 'mari@erametsad.ee', active: true },
    })
    const bus = new EventBus()
    startListening(bus)

    bus.emit({
      type: 'submission.new',
      userId: 'sp-mari',
      payload: { objectTitle: 'Kinnistu müük 12345:001:0001', submitterName: 'Mati Mets' },
    })

    await vi.waitFor(() => {
      expect(sendEmailMock).toHaveBeenCalledTimes(1)
    })
    expect(sendEmailMock).toHaveBeenCalledWith({
      from: 'noreply@erametsad.ee',
      to: 'mari@erametsad.ee',
      subject: 'Uus objektipakkumine on teile määratud',
      html: expect.stringContaining('Mati Mets') as string,
    })
    // Specialists are not users; the user_id FK forbids a row for them.
    expect(notificationRows('submission.new')).toEqual([])
  })

  it('skips the send and any row when the specialist has no email address', async () => {
    await repos.create({
      collection: 'specialists',
      data: { id: 'sp-empty', name: 'Ilma Meilita', slug: 'sp-empty', active: true },
    })
    const bus = new EventBus()
    startListening(bus)

    bus.emit({
      type: 'submission.new',
      userId: 'sp-empty',
      payload: { objectTitle: 'Raieõiguse müük 78402:003:0210', submitterName: 'Mati Mets' },
    })

    await vi.waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('No email address'))
    })
    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(notificationRows('submission.new')).toEqual([])
  })
})

describe('sale submission emits both notifications', () => {
  function submission(overrides: Partial<SaleSubmission> = {}): SaleSubmission {
    return {
      branch: 'sale',
      objectType: 'raieoigus',
      cadastres: ['78402:003:0210'],
      areaHa: 12.4,
      species: ['MA', 'KU'],
      loggingTypes: ['HL'],
      description: 'Müüa raieõigus Harjumaal.',
      contact: { name: 'Mati Mets', phone: '+37251234567', email: 'mati@mets.ee' },
      ...overrides,
    }
  }

  it('emits submission.received to the seller and submission.new to the specialist', async () => {
    await repos.create({ collection: 'users', data: { id: 'seller-1', email: 'seller@example.ee' } })
    await repos.create({
      collection: 'specialists',
      data: { id: 'sp-aadu', name: 'Aadu', slug: 'sp-aadu', email: 'aadu@erametsad.ee', active: true },
    })
    const emitted: DomainEvent[] = []

    await ingestSaleSubmission(submission(), 'seller-1', {
      repositories: repos,
      notifications: { emit: (event) => emitted.push(event) },
    })

    expect(emitted).toEqual([
      {
        type: 'submission.received',
        userId: 'seller-1',
        payload: { objectTitle: 'Raieõiguse müük 78402:003:0210' },
      },
      {
        type: 'submission.new',
        userId: 'sp-aadu',
        payload: { objectTitle: 'Raieõiguse müük 78402:003:0210', submitterName: 'Mati Mets' },
      },
    ])
  })

  it('skips the specialist notice when no specialist is assigned', async () => {
    await repos.create({ collection: 'users', data: { id: 'seller-1', email: 'seller@example.ee' } })
    const emitted: DomainEvent[] = []

    await ingestSaleSubmission(submission(), 'seller-1', {
      repositories: repos,
      notifications: { emit: (event) => emitted.push(event) },
    })

    expect(emitted).toEqual([
      {
        type: 'submission.received',
        userId: 'seller-1',
        payload: { objectTitle: 'Raieõiguse müük 78402:003:0210' },
      },
    ])
  })
})

describe('service request emits the submitter confirmation', () => {
  function serviceServices(emitted: DomainEvent[]): ServiceRequestServices {
    return {
      serviceRequests: createServiceRequestsRepository(testDb.database),
      partners: createPartnersRepository(testDb.database),
      notifications: { emit: (event) => emitted.push(event) },
    }
  }

  const hooldusraieBody = {
    type: 'hooldusraie',
    contact: { name: 'Mati Mets', phone: '+37251234567', email: 'mati@mets.ee' },
    county: 'TA',
    cadastres: ['12345:001:0001'],
    provisions: 'Raie ja välavedu',
    services: ['hooldamine'],
  }

  it('confirms the portal submitter with the service title as objectTitle', async () => {
    const emitted: DomainEvent[] = []

    await ingestServiceRequest(
      {
        body: hooldusraieBody,
        formName: 'hooldusraie',
        consentAt: '2026-01-01T00:00:00Z',
        userId: 'seller-1',
      },
      serviceServices(emitted),
    )

    expect(emitted).toEqual([
      {
        type: 'submission.received',
        userId: 'seller-1',
        payload: { objectTitle: 'Hooldusraie 12345:001:0001' },
      },
    ])
  })

  it('sends no confirmation for anonymous marketing-funnel submissions', async () => {
    const emitted: DomainEvent[] = []

    await ingestServiceRequest(
      {
        body: hooldusraieBody,
        formName: 'hooldusraie',
        consentAt: '2026-01-01T00:00:00Z',
      },
      serviceServices(emitted),
    )

    expect(emitted).toEqual([])
  })
})

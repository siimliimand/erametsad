import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }))

vi.mock('../email-sender', () => ({
  sendEmail: sendEmailMock,
}))

vi.mock('@/env', () => ({
  env: { SMTP_FROM: 'noreply@erametsad.ee' },
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { EventBus, type DomainEvent } from '../event-bus'
import { startListening } from '../service'

import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'

process.env.ISIKUKOOD_ENCRYPTION_KEY = process.env.ISIKUKOOD_ENCRYPTION_KEY ?? 'integration-test-key'

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

interface CreateCall {
  collection: string
  data: Record<string, unknown>
}

function makeRepos(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  return {
    find: vi.fn().mockRejectedValue(new Error('UnknownCollection: profile')),
    findByID: vi.fn().mockResolvedValue({ email: 'user@example.ee' }),
    create: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

function outbidEvent(userId: string, auctionTitle: string): DomainEvent {
  return {
    type: 'outbid',
    userId,
    payload: { auctionTitle, currentBid: 150 },
  }
}

function auctionWonEvent(userId: string, auctionTitle: string): DomainEvent {
  return {
    type: 'auction.won',
    userId,
    payload: { auctionTitle, winningBid: 150 },
  }
}

function contractReadyEvent(userId: string, auctionTitle: string): DomainEvent {
  return {
    type: 'contract.ready',
    userId,
    payload: { auctionTitle },
  }
}

async function emitAndCollect(
  bus: EventBus,
  event: DomainEvent,
  create: ReturnType<typeof vi.fn>,
  expectedCalls = 1,
): Promise<CreateCall[]> {
  bus.emit(event)
  await vi.waitFor(() => {
    expect(create.mock.calls).toHaveLength(expectedCalls)
  })
  return create.mock.calls.map(([options]) => options as CreateCall)
}

function rowFor(calls: CreateCall[], channel: string): Record<string, unknown> {
  const row = calls.find((call) => call.data.channel === channel)
  if (row === undefined) {
    throw new Error(`expected a ${channel} notification row, got channels: ${calls.map((call) => String(call.data.channel)).join(', ')}`)
  }
  return row.data
}

let bus: EventBus
let createMock: ReturnType<typeof vi.fn>
let consoleWarn: ReturnType<typeof vi.spyOn>
let consoleError: ReturnType<typeof vi.spyOn>

beforeAll(() => {
  const repos = makeRepos()
  createMock = repos.create
  vi.mocked(getRepositories).mockImplementation(() => Promise.resolve(repos as never))
})

beforeEach(() => {
  vi.clearAllMocks()
  bus = new EventBus()
  startListening(bus)
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  // restoreAllMocks would also wipe the vi.fn() implementations set in
  // beforeAll; only the console spies need restoring.
  consoleWarn.mockRestore()
  consoleError.mockRestore()
})

describe('notification email dispatch', () => {
  it('records the send result, timestamp, and per-recipient delivery on success', async () => {
    sendEmailMock.mockResolvedValue({ success: true, transport: 'smtp', messageId: '<m-1@mailpit>' })

    const calls = await emitAndCollect(bus, outbidEvent('u-success', 'Mets A'), createMock, 2)

    expect(sendEmailMock).toHaveBeenCalledWith({
      from: 'noreply@erametsad.ee',
      to: 'user@example.ee',
      subject: 'Teie pakkumus on üle pakutud',
      html: expect.stringContaining('Mets A') as string,
    })
    const row = rowFor(calls, 'email')
    expect(row.errorCode).toBeNull()
    expect(row.sendResult).toEqual({ success: true, transport: 'smtp', messageId: '<m-1@mailpit>' })
    expect(row.recipientResults).toEqual([{ email: 'user@example.ee', status: 'delivered' }])
    expect(row.sentAt).toMatch(ISO_TIMESTAMP)
  })

  it('leaves delivery fields off the in-app row', async () => {
    sendEmailMock.mockResolvedValue({ success: true, transport: 'email-binding', messageId: 'b-1' })

    const calls = await emitAndCollect(bus, outbidEvent('u-inapp', 'Mets B'), createMock, 2)

    const inApp = rowFor(calls, 'in_app')
    expect(inApp).not.toHaveProperty('sendResult')
    expect(inApp).not.toHaveProperty('errorCode')
    expect(inApp).not.toHaveProperty('recipientResults')
  })

  it('surfaces the error code on the row when the send fails', async () => {
    const failure = {
      success: false,
      transport: 'cloudflare-api',
      error: { code: 'E_DAILY_LIMIT_EXCEEDED', message: 'daily limit exceeded' },
    }
    sendEmailMock.mockResolvedValue(failure)

    const calls = await emitAndCollect(bus, outbidEvent('u-quota', 'Mets C'), createMock, 2)

    const row = rowFor(calls, 'email')
    expect(row.errorCode).toBe('E_DAILY_LIMIT_EXCEEDED')
    expect(row.sendResult).toEqual(failure)
    expect(row.recipientResults).toEqual([{ email: 'user@example.ee', status: 'failed' }])
    expect(row.sentAt).toBeNull()
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('E_DAILY_LIMIT_EXCEEDED'))
  })

  it('records a permanent bounce as a per-recipient status', async () => {
    sendEmailMock.mockResolvedValue({
      success: false,
      transport: 'cloudflare-api',
      error: { code: 'E_PERMANENT_BOUNCE', message: 'All recipients permanently bounced' },
    })

    const calls = await emitAndCollect(bus, outbidEvent('u-bounce', 'Mets D'), createMock, 2)

    expect(rowFor(calls, 'email').recipientResults).toEqual([
      { email: 'user@example.ee', status: 'permanent_bounces' },
    ])
  })

  it('records E_NO_RECIPIENT and skips the sender when the user has no address', async () => {
    const repos = makeRepos({ findByID: vi.fn().mockResolvedValue(null) })
    const localCreate = repos.create
    vi.mocked(getRepositories).mockImplementationOnce(() => Promise.resolve(repos as never))

    const calls = await emitAndCollect(bus, outbidEvent('u-missing', 'Mets E'), localCreate, 2)

    expect(sendEmailMock).not.toHaveBeenCalled()
    const row = rowFor(calls, 'email')
    expect(row.errorCode).toBe('E_NO_RECIPIENT')
    expect(row.recipientResults).toEqual([])
    expect(row.sendResult).toBeUndefined()
    expect(row.sentAt).toBeNull()
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('No email address'))
  })

  it('honors notification preferences from the repository when present', async () => {
    const repos = makeRepos({
      find: vi.fn().mockResolvedValue({
        docs: [{ notificationPreferences: { outbid: { email: false, sms: false } } }],
      }),
    })
    const localCreate = repos.create
    vi.mocked(getRepositories).mockImplementationOnce(() => Promise.resolve(repos as never))

    const calls = await emitAndCollect(bus, outbidEvent('u-prefs', 'Mets F'), localCreate)

    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(calls.some((call) => call.data.channel === 'email')).toBe(false)
    expect(calls.some((call) => call.data.channel === 'in_app')).toBe(true)
  })

  it('dispatches a duplicate event only once per user', async () => {
    sendEmailMock.mockResolvedValue({ success: true, transport: 'smtp', messageId: '<m-2@mailpit>' })

    const event = outbidEvent('u-dedupe', 'Mets G')
    await emitAndCollect(bus, event, createMock, 2)
    bus.emit(event)
    await new Promise((resolve) => setTimeout(resolve, 20))

    const emailCalls = createMock.mock.calls.filter(
      ([options]) => (options as CreateCall).data.channel === 'email',
    )
    expect(emailCalls).toHaveLength(1)
  })
})

describe('default channel matrix', () => {
  it('queues the historical channels when the profile stores no preferences', async () => {
    sendEmailMock.mockResolvedValue({ success: true, transport: 'smtp', messageId: '<m-matrix@mailpit>' })
    const repos = makeRepos({
      find: vi.fn().mockResolvedValue({
        docs: [{ id: 'p-matrix', notificationPreferences: null }],
      }),
    })
    const localCreate = repos.create
    vi.mocked(getRepositories).mockImplementationOnce(() => Promise.resolve(repos as never))

    const calls = await emitAndCollect(bus, auctionWonEvent('u-defaults', 'Mets H'), localCreate, 2)

    expect(calls.map((call) => call.data.channel).sort()).toEqual(['email', 'in_app'])
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
  })

  it('queues the historical channels when no profile exists', async () => {
    sendEmailMock.mockResolvedValue({ success: true, transport: 'smtp', messageId: '<m-noprofile@mailpit>' })
    const repos = makeRepos({ find: vi.fn().mockResolvedValue({ docs: [] }) })
    const localCreate = repos.create
    vi.mocked(getRepositories).mockImplementationOnce(() => Promise.resolve(repos as never))

    const calls = await emitAndCollect(bus, auctionWonEvent('u-noprofile', 'Mets I'), localCreate, 2)

    expect(calls.map((call) => call.data.channel).sort()).toEqual(['email', 'in_app'])
  })
})

describe('muted channels', () => {
  it('skips the email channel the profile muted for the event', async () => {
    const repos = makeRepos({
      find: vi.fn().mockResolvedValue({
        docs: [{ notificationPreferences: { outbid: { email: false } } }],
      }),
    })
    const localCreate = repos.create
    vi.mocked(getRepositories).mockImplementationOnce(() => Promise.resolve(repos as never))

    const calls = await emitAndCollect(bus, outbidEvent('u-email-muted', 'Mets J'), localCreate, 1)

    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(calls.map((call) => call.data.channel)).toEqual(['in_app'])
  })

  it('skips the sms channel the profile muted for the event', async () => {
    sendEmailMock.mockResolvedValue({ success: true, transport: 'smtp', messageId: '<m-sms-muted@mailpit>' })
    const repos = makeRepos({
      find: vi.fn().mockResolvedValue({
        docs: [{ notificationPreferences: { 'contract.ready': { sms: false } } }],
      }),
    })
    const localCreate = repos.create
    vi.mocked(getRepositories).mockImplementationOnce(() => Promise.resolve(repos as never))

    const calls = await emitAndCollect(bus, contractReadyEvent('u-sms-muted', 'Mets K'), localCreate, 2)

    expect(calls.map((call) => call.data.channel).sort()).toEqual(['email', 'in_app'])
  })

  it('keeps other events unaffected by an event-level mute', async () => {
    sendEmailMock.mockResolvedValue({ success: true, transport: 'smtp', messageId: '<m-eventmute@mailpit>' })
    const repos = makeRepos({
      find: vi.fn().mockResolvedValue({
        docs: [{ notificationPreferences: { outbid: { email: false, sms: false } } }],
      }),
    })
    const localCreate = repos.create
    vi.mocked(getRepositories).mockImplementationOnce(() => Promise.resolve(repos as never))

    const muted = await emitAndCollect(bus, outbidEvent('u-event-mute', 'Mets L'), localCreate, 1)
    expect(muted.map((call) => call.data.channel)).toEqual(['in_app'])

    vi.mocked(getRepositories).mockImplementationOnce(() => Promise.resolve(repos as never))
    const after = await emitAndCollect(bus, auctionWonEvent('u-event-mute', 'Mets M'), localCreate, 3)
    const wonRows = after.filter((call) => call.data.event === 'auction.won')
    expect(wonRows.map((call) => call.data.channel).sort()).toEqual(['email', 'in_app'])
  })
})

describe('persisted preferences reload into the channel matrix', () => {
  let testDb: SqliteTestDb

  beforeEach(() => {
    sendEmailMock.mockResolvedValue({ success: true, transport: 'smtp', messageId: '<m-persist@mailpit>' })
    testDb = createSqliteTestDb()
  })

  afterEach(() => {
    testDb.close()
  })

  function realRepos(): CoreRepositories {
    return createCoreRepositories(testDb.database, {
      isikukoodCodec: nodeIsikukoodCodec,
      batch: sqliteBatchRunner(testDb.raw),
    })
  }

  function storedChannels(userId: string): string[] {
    return (
      testDb.raw
        .prepare('select channel from notifications where user_id = ?')
        .all(userId) as { channel: string }[]
    )
      .map((row) => row.channel)
      .sort()
  }

  it('writes preferences as TEXT-JSON through the profile repository and honors them on dispatch', async () => {
    const repos = realRepos()
    await repos.create({ collection: 'users', data: { id: 'u-persist-a', email: 'persist-a@example.ee' } })
    await repos.create({ collection: 'users', data: { id: 'u-persist-b', email: 'persist-b@example.ee' } })
    const mutedEmail = { outbid: { email: false } }
    const smsOptIn = { 'auction.won': { sms: true }, 'not.a.domain.event': { email: false, sms: false } }
    await repos.create({
      collection: 'profile',
      data: { type: 'private', userId: 'u-persist-a', notificationPreferences: mutedEmail },
    })
    await repos.create({
      collection: 'profile',
      data: { type: 'private', userId: 'u-persist-b', notificationPreferences: smsOptIn },
    })

    const stored = testDb.raw
      .prepare('select notification_preferences from profiles where user_id = ?')
      .get('u-persist-a') as { notification_preferences: string | null } | undefined
    if (typeof stored?.notification_preferences !== 'string') {
      throw new Error('notification preferences not stored')
    }
    expect(JSON.parse(stored.notification_preferences)).toEqual(mutedEmail)

    vi.mocked(getRepositories).mockImplementationOnce(() => Promise.resolve(repos as never))
    bus.emit(outbidEvent('u-persist-a', 'Mets N'))
    await vi.waitFor(() => { expect(storedChannels('u-persist-a')).toEqual(['in_app']); })

    vi.mocked(getRepositories).mockImplementationOnce(() => Promise.resolve(repos as never))
    bus.emit(auctionWonEvent('u-persist-b', 'Mets O'))
    await vi.waitFor(() => { expect(storedChannels('u-persist-b')).toEqual(['email', 'in_app', 'sms']); })
  })

  it('falls back to the default matrix when the stored TEXT is not valid JSON', async () => {
    const repos = realRepos()
    await repos.create({ collection: 'users', data: { id: 'u-corrupt', email: 'corrupt@example.ee' } })
    const now = new Date().toISOString()
    testDb.raw
      .prepare(
        "insert into profiles (id, type, approval_status, user_id, notification_preferences, created_at, updated_at) values ('p-corrupt', 'private', 'pending', 'u-corrupt', '{nope', ?, ?)",
      )
      .run(now, now)

    vi.mocked(getRepositories).mockImplementationOnce(() => Promise.resolve(repos as never))
    bus.emit(auctionWonEvent('u-corrupt', 'Mets P'))
    await vi.waitFor(() => { expect(storedChannels('u-corrupt')).toEqual(['email', 'in_app']); })
  })
})

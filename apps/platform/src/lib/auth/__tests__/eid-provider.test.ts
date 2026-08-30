import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_DEMO_ISIKUKOODS,
  DemoEidProvider,
  EidEasyProvider,
  EIDEASY_DEFAULT_API_URL,
  completeEidLogin,
  getDemoIsikukoods,
  getEidProvider,
} from '../eid-provider'

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { verifyAccessTokenAsync, verifyRefreshTokenAsync } from '@/lib/auth/jwt'
import { hash } from '@/lib/crypto'
import { getRepositories } from '@/lib/data/runtime'
import { setD1ForTests, type DbDatabase, type DbPreparedStatement, type DbResult, type SqlParam } from '@/lib/db'

process.env.JWT_SECRET = 'test-secret-used-only-by-vitest'

const defaultIsikukood = '38803160272'

// completeEidLogin persists the session through the D1-backed store;
// this stub accepts those statements without asserting on them.
function recordingD1(): DbDatabase {
  return {
    prepare(sql: string) {
      let params: SqlParam[] = []
      const statement: DbPreparedStatement = {
        bind(...values: SqlParam[]) {
          params = values
          return statement
        },
        all<T>(): Promise<DbResult<T>> {
          void sql
          void params
          return Promise.resolve({ results: [], success: true, meta: { changes: 1 } })
        },
      }
      return statement
    },
    batch<T>(prepared: DbPreparedStatement[]): Promise<DbResult<T>[]> {
      return Promise.all(prepared.map((statement) => statement.all<T>()))
    },
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  setD1ForTests(null)
})

describe('DemoEidProvider', () => {
  it('rejects an unknown isikukood', async () => {
    const provider = new DemoEidProvider()

    await expect(provider.start('11111111111')).rejects.toThrow(
      'Unknown isikukood',
    )
  })

  it('completes only after status polling confirmed the session', async () => {
    const provider = new DemoEidProvider()
    const { sessionRef } = await provider.start(defaultIsikukood)

    await expect(provider.complete(sessionRef)).rejects.toThrow(
      'Session not completed',
    )

    expect(await provider.status(sessionRef)).toEqual({ status: 'pending' })

    const finalStatus = await provider.status(sessionRef)
    expect(finalStatus.status).toBe('completed')

    const result = await provider.complete(sessionRef)
    expect(result.isikukood).toBe(defaultIsikukood)
    expect(result.user).toMatchObject({ email: 'jaan@example.com' })
  })

  it('consumes the session on complete', async () => {
    const provider = new DemoEidProvider()
    const { sessionRef } = await provider.start(defaultIsikukood)

    await provider.status(sessionRef)
    await provider.status(sessionRef)
    await provider.complete(sessionRef)

    await expect(provider.complete(sessionRef)).rejects.toThrow(
      'Session not completed',
    )
  })

  it('accepts isikukoods configured through EID_DEMO_ISIKUKOOD', async () => {
    vi.stubEnv('EID_DEMO_ISIKUKOOD', '50001019906, 60001019928')
    const provider = new DemoEidProvider()

    expect(getDemoIsikukoods()).toEqual(['50001019906', '60001019928'])
    await expect(provider.start(defaultIsikukood)).rejects.toThrow(
      'Unknown isikukood',
    )
    await expect(provider.start('50001019906')).resolves.toHaveProperty(
      'sessionRef',
    )
  })

  it('falls back to the default isikukoods', () => {
    expect(getDemoIsikukoods()).toEqual(DEFAULT_DEMO_ISIKUKOODS)
  })
})

describe('DemoEidProvider with seeded users', () => {
  let find: ReturnType<typeof vi.fn>
  const seededIsikukood = '10000000002'

  beforeEach(() => {
    find = vi.fn()
    vi.mocked(getRepositories).mockImplementation(() => ({ find }) as never)
  })

  it('starts a session for any isikukood that hashes to a seeded user', async () => {
    find.mockResolvedValue({
      docs: [
        {
          id: 'user-2',
          email: 'private@eametsad.ee',
          name: 'Eraklient Erika',
          role: 'private',
          status: 'active',
        },
      ],
    })
    const provider = new DemoEidProvider()
    const { sessionRef } = await provider.start(seededIsikukood)

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        where: { isikukoodHash: { equals: hash(seededIsikukood) } },
      }),
    )
    expect(await provider.status(sessionRef)).toEqual({ status: 'pending' })
    const finalStatus = await provider.status(sessionRef)
    expect(finalStatus.status).toBe('completed')
    expect(finalStatus.user).toMatchObject({ email: 'private@eametsad.ee' })
    await expect(provider.complete(sessionRef)).resolves.toHaveProperty(
      'isikukood',
      seededIsikukood,
    )
  })

  it('starts a session for a suspended seeded user; complete rejects later', async () => {
    find.mockResolvedValue({
      docs: [
        {
          id: 'user-2',
          email: 'private@eametsad.ee',
          role: 'private',
          status: 'suspended',
        },
      ],
    })
    const provider = new DemoEidProvider()

    await expect(provider.start(seededIsikukood)).resolves.toHaveProperty(
      'sessionRef',
    )
  })

  it('rejects an isikukood with no seeded user', async () => {
    find.mockResolvedValue({ docs: [] })
    const provider = new DemoEidProvider()

    await expect(provider.start(seededIsikukood)).rejects.toThrow(
      'Unknown isikukood',
    )
  })
})

describe('completeEidLogin', () => {
  let find: ReturnType<typeof vi.fn>

  beforeEach(() => {
    find = vi.fn()
    setD1ForTests(recordingD1())
    vi.mocked(getRepositories).mockImplementation(
      () => ({ find }) as never,
    )
  })

  async function startCompletedSession() {
    const provider = getEidProvider('smartid')
    const { sessionRef } = await provider.start(defaultIsikukood)
    await provider.status(sessionRef)
    await provider.status(sessionRef)
    return sessionRef
  }

  it('returns 400 without cookies for a still-pending session', async () => {
    const provider = getEidProvider('smartid')
    const { sessionRef } = await provider.start(defaultIsikukood)

    const response = await completeEidLogin('smartid', sessionRef)

    expect(response.status).toBe(400)
    expect(response.cookies.get('access_token')).toBeUndefined()
    expect(response.cookies.get('refresh_token')).toBeUndefined()
    expect(find).not.toHaveBeenCalled()
  })

  it('creates a session with httpOnly cookies for a completed session', async () => {
    const sessionRef = await startCompletedSession()
    find.mockResolvedValue({
      docs: [
        {
          id: 'user-1',
          email: 'jaan@example.com',
          name: 'Jaan Tamm',
          role: 'private',
          profileId: 'profile-1',
          status: 'active',
        },
      ],
    })

    const response = await completeEidLogin('smartid', sessionRef)

    expect(response.status).toBe(200)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        where: { isikukoodHash: { equals: hash(defaultIsikukood) } },
      }),
    )

    const body = (await response.json()) as { user: Record<string, unknown> }
    expect(body.user).toMatchObject({ id: 'user-1', email: 'jaan@example.com' })

    const accessToken = response.cookies.get('access_token')
    const refreshToken = response.cookies.get('refresh_token')
    expect(accessToken?.value).toBeTruthy()
    expect(accessToken?.httpOnly).toBe(true)
    expect(refreshToken?.value).toBeTruthy()
    expect(refreshToken?.httpOnly).toBe(true)
  })

  it('returns 400 for an unknown session reference', async () => {
    const response = await completeEidLogin('smartid', 'missing-ref')

    expect(response.status).toBe(400)
    expect(response.cookies.get('access_token')).toBeUndefined()
  })

  it('returns 401 when no user matches the isikukood', async () => {
    const sessionRef = await startCompletedSession()
    find.mockResolvedValue({ docs: [] })

    const response = await completeEidLogin('smartid', sessionRef)

    expect(response.status).toBe(401)
    const body = (await response.json()) as { code?: unknown }
    expect(body.code).toBeUndefined()
    expect(response.cookies.get('access_token')).toBeUndefined()
  })

  it('returns 401 with the ACCOUNT_SUSPENDED code for a suspended user', async () => {
    const sessionRef = await startCompletedSession()
    find.mockResolvedValue({
      docs: [
        {
          id: 'user-2',
          email: 'mari@example.com',
          role: 'private',
          status: 'suspended',
        },
      ],
    })

    const response = await completeEidLogin('smartid', sessionRef)

    expect(response.status).toBe(401)
    const body = (await response.json()) as { code?: unknown }
    expect(body.code).toBe('ACCOUNT_SUSPENDED')
    expect(response.cookies.get('access_token')).toBeUndefined()
  })
})

describe('EidEasyProvider (sandbox contract)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.stubEnv('EIDEASY_CLIENT_ID', 'sandbox-client')
    vi.stubEnv('EIDEASY_SECRET', 'sandbox-secret')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function jsonReply(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }

  const completedData = {
    identifier: '38803160272',
    first_name: 'Jaan',
    last_name: 'Tamm',
  }

  it('sends credentials to the sandbox start-session endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonReply({
        status: 'OK',
        data: {
          session_token: 'sbx-token-1',
          verification_control_code: '3042',
        },
      }),
    )

    const provider = getEidProvider('smartid')
    expect(provider).toBeInstanceOf(EidEasyProvider)
    const result = await provider.start('38803160272')

    expect(result).toEqual({ sessionRef: 'sbx-token-1', controlCode: '3042' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [calledUrl, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(calledUrl).toEqual(
      new URL('api/identity/start-session', EIDEASY_DEFAULT_API_URL),
    )
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      client_id: 'sandbox-client',
      secret: 'sandbox-secret',
      method: 'smartid',
      identifier: '38803160272',
    })
  })

  it('honors EIDEASY_API_URL for a private sandbox base URL', async () => {
    vi.stubEnv('EIDEASY_API_URL', 'https://sandbox.aggregator.example')
    fetchMock.mockResolvedValueOnce(
      jsonReply({ status: 'OK', data: { session_token: 'sbx-token-2' } }),
    )

    await getEidProvider('mobileid').start('47012130215')

    const [calledUrl] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(String(calledUrl)).toBe(
      'https://sandbox.aggregator.example/api/identity/start-session',
    )
  })

  it('rejects when the aggregator refuses to start the session', async () => {
    fetchMock.mockResolvedValueOnce(jsonReply({ status: 'ERROR' }))

    await expect(
      getEidProvider('idcard').start('38803160272'),
    ).rejects.toThrow('eID aggregator refused to start the session')
  })

  it('rejects when the aggregator answers with an HTTP error', async () => {
    fetchMock.mockResolvedValueOnce(jsonReply({ status: 'OK' }, 500))

    await expect(
      getEidProvider('smartid').start('38803160272'),
    ).rejects.toThrow('eID aggregator request failed: 500')
  })

  it('maps PENDING, COMPLETED, and ERROR status responses', async () => {
    const provider = getEidProvider('smartid')

    fetchMock.mockResolvedValueOnce(jsonReply({ status: 'PENDING' }))
    expect(await provider.status('sbx-token-1')).toEqual({
      status: 'pending',
    })

    fetchMock.mockResolvedValueOnce(
      jsonReply({ status: 'COMPLETED', data: completedData }),
    )
    expect(await provider.status('sbx-token-1')).toEqual({
      status: 'completed',
      user: completedData,
    })

    fetchMock.mockResolvedValueOnce(jsonReply({ status: 'ERROR' }))
    expect(await provider.status('sbx-token-1')).toEqual({ status: 'failed' })
  })

  it('reports failed instead of throwing when the status call errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    await expect(
      getEidProvider('smartid').status('sbx-token-1'),
    ).resolves.toEqual({ status: 'failed' })
  })

  it('completes with the identifier from the sandbox response', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonReply({ status: 'COMPLETED', data: completedData }),
    )

    await expect(
      getEidProvider('smartid').complete('sbx-token-1'),
    ).resolves.toEqual({ user: completedData, isikukood: '38803160272' })
  })

  it('refuses to complete a session that is not COMPLETED', async () => {
    fetchMock.mockResolvedValueOnce(jsonReply({ status: 'PENDING' }))

    await expect(
      getEidProvider('smartid').complete('sbx-token-1'),
    ).rejects.toThrow('Session not completed')
  })

  it('selects the demo provider when aggregator credentials are absent', () => {
    vi.unstubAllEnvs()

    expect(getEidProvider('smartid')).toBeInstanceOf(DemoEidProvider)
  })
})

describe('completeEidLogin over the aggregator', () => {
  let find: ReturnType<typeof vi.fn>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    find = vi.fn()
    setD1ForTests(recordingD1())
    vi.mocked(getRepositories).mockImplementation(() => ({ find }) as never)

    vi.stubEnv('EIDEASY_CLIENT_ID', 'sandbox-client')
    vi.stubEnv('EIDEASY_SECRET', 'sandbox-secret')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockImplementation(
      () =>
        new Response(
          JSON.stringify({
            status: 'COMPLETED',
            data: {
              identifier: defaultIsikukood,
              first_name: 'Jaan',
              last_name: 'Tamm',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('looks up the user by the sandbox-reported isikukood', async () => {
    find.mockResolvedValue({
      docs: [
        {
          id: 'user-1',
          email: 'jaan@example.com',
          name: 'Jaan Tamm',
          role: 'private',
          profileId: 'profile-1',
          status: 'active',
        },
      ],
    })

    const response = await completeEidLogin('smartid', 'sbx-token-1')

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(JSON.parse(init.body as string)).toMatchObject({
      session_token: 'sbx-token-1',
    })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        where: { isikukoodHash: { equals: hash(defaultIsikukood) } },
      }),
    )
  })

  it('issues tokens that verify through Web Crypto (crypto.subtle)', async () => {
    find.mockResolvedValue({
      docs: [
        {
          id: 'user-1',
          email: 'jaan@example.com',
          name: 'Jaan Tamm',
          role: 'private',
          profileId: 'profile-1',
          status: 'active',
        },
      ],
    })

    const response = await completeEidLogin('smartid', 'sbx-token-1')

    const accessToken = response.cookies.get('access_token')?.value
    const refreshToken = response.cookies.get('refresh_token')?.value
    expect(accessToken).toBeTruthy()
    expect(refreshToken).toBeTruthy()
    if (!accessToken || !refreshToken) {
      throw new Error('session cookies missing after eID login')
    }

    const accessPayload = await verifyAccessTokenAsync(accessToken)
    expect(accessPayload).toMatchObject({ userId: 'user-1', role: 'private' })

    const refreshPayload = await verifyRefreshTokenAsync(refreshToken)
    expect(typeof refreshPayload?.sessionId).toBe('string')
  })

  it('returns 401 when the sandbox reports an unknown user', async () => {
    fetchMock.mockImplementation(
      () =>
        new Response(JSON.stringify({ status: 'COMPLETED', data: {
          identifier: '50001018906',
          first_name: 'Tundmatu',
          last_name: 'Isik',
        } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    find.mockResolvedValue({ docs: [] })

    const response = await completeEidLogin('smartid', 'sbx-token-1')

    expect(response.status).toBe(401)
    expect(response.cookies.get('access_token')).toBeUndefined()
  })
})

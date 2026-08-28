import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_DEMO_ISIKUKOODS,
  DemoEidProvider,
  completeEidLogin,
  getDemoIsikukoods,
  getEidProvider,
} from '../eid-provider'

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

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
    expect(response.cookies.get('access_token')).toBeUndefined()
  })

  it('returns 401 for a suspended user', async () => {
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
    expect(response.cookies.get('access_token')).toBeUndefined()
  })
})

import { NextResponse } from 'next/server'

import { createSession, setSessionCookies } from '@/lib/auth/session'
import { hash } from '@/lib/crypto'
import { getRepositories } from '@/lib/data/runtime'
import { getUserRole } from '@/payload/access/roles'

export type EidMethod = 'smartid' | 'mobileid' | 'idcard'

export interface EidSession {
  sessionRef: string
  isikukood: string
  controlCode: string
  status: 'pending' | 'completed' | 'failed'
  user: Record<string, unknown>
  pollCount: number
}

export interface EidProvider {
  start(isikukood: string): Promise<{ sessionRef: string; controlCode?: string }>
  status(sessionRef: string): Promise<{
    status: 'pending' | 'completed' | 'failed'
    user?: Record<string, unknown>
  }>
  complete(sessionRef: string): Promise<{
    user: Record<string, unknown>
    isikukood: string
  }>
}

const DEMO_PROFILES: Record<string, unknown>[] = [
  {
    id: 'demo-001',
    email: 'jaan@example.com',
    name: 'Jaan Tamm',
    role: 'private',
  },
  {
    id: 'demo-002',
    email: 'mari@example.com',
    name: 'Mari Laan',
    role: 'private',
  },
  {
    id: 'demo-003',
    email: 'toivo@example.com',
    name: 'Toivo Kuusk',
    role: 'company',
  },
]

export const DEFAULT_DEMO_ISIKUKOODS = [
  '38803160272',
  '47012130215',
  '60001010205',
]

export function getDemoIsikukoods(): string[] {
  const raw = process.env.EID_DEMO_ISIKUKOOD
  if (!raw?.trim()) {
    return DEFAULT_DEMO_ISIKUKOODS
  }
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function buildDemoUsers(): Record<string, Record<string, unknown>> {
  const users: Record<string, Record<string, unknown>> = {}
  const isikukoods = getDemoIsikukoods()
  isikukoods.forEach((isikukood, index) => {
    users[isikukood] = { ...DEMO_PROFILES[index % DEMO_PROFILES.length] }
  })
  return users
}

export class DemoEidProvider implements EidProvider {
  private sessions = new Map<string, EidSession>()

  start(
    isikukood: string,
  ): Promise<{ sessionRef: string; controlCode?: string }> {
    const user = buildDemoUsers()[isikukood]
    if (!user) {
      return Promise.reject(new Error('Unknown isikukood'))
    }

    const sessionRef = crypto.randomUUID()
    const controlCode = String(Math.floor(100000 + Math.random() * 900000))

    this.sessions.set(sessionRef, {
      sessionRef,
      isikukood,
      controlCode,
      status: 'pending',
      user,
      pollCount: 0,
    })

    return Promise.resolve({ sessionRef, controlCode })
  }

  status(
    sessionRef: string,
  ): Promise<{ status: 'pending' | 'completed' | 'failed'; user?: Record<string, unknown> }> {
    const session = this.sessions.get(sessionRef)
    if (!session) {
      return Promise.resolve({ status: 'failed' as const })
    }

    session.pollCount++

    if (session.pollCount >= 2) {
      session.status = 'completed'
      return Promise.resolve({ status: 'completed' as const, user: session.user })
    }

    return Promise.resolve({ status: 'pending' as const })
  }

  complete(sessionRef: string): Promise<{
    user: Record<string, unknown>
    isikukood: string
  }> {
    const session = this.sessions.get(sessionRef)
    if (session?.status !== 'completed') {
      return Promise.reject(new Error('Session not completed'))
    }

    this.sessions.delete(sessionRef)

    return Promise.resolve({ user: session.user, isikukood: session.isikukood })
  }
}

const demoProvider = new DemoEidProvider()

export interface EidEasyConfig {
  clientId: string
  secret: string
  apiUrl: string
}

export const EIDEASY_DEFAULT_API_URL = 'https://id.eideasy.com'

// Field names follow the eID Easy identity API (docs.eideasy.com); the
// sandbox run in docs/EID-PORT.md must confirm them before production.
interface EidEasyResponse {
  status?: string
  data?: Record<string, unknown>
}

export function getEidEasyConfig(): EidEasyConfig | null {
  const clientId = process.env.EIDEASY_CLIENT_ID?.trim()
  const secret = process.env.EIDEASY_SECRET?.trim()
  if (!clientId || !secret) {
    return null
  }
  return {
    clientId,
    secret,
    apiUrl: process.env.EIDEASY_API_URL?.trim() ?? EIDEASY_DEFAULT_API_URL,
  }
}

export class EidEasyProvider implements EidProvider {
  constructor(
    private readonly config: EidEasyConfig,
    private readonly method: EidMethod,
  ) {}

  private async post(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<EidEasyResponse> {
    const response = await fetch(new URL(path, this.config.apiUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.clientId,
        secret: this.config.secret,
        ...payload,
      }),
    })

    if (!response.ok) {
      throw new Error(
        `eID aggregator request failed: ${String(response.status)}`,
      )
    }
    return (await response.json()) as EidEasyResponse
  }

  async start(
    isikukood: string,
  ): Promise<{ sessionRef: string; controlCode?: string }> {
    const result = await this.post('api/identity/start-session', {
      method: this.method,
      identifier: isikukood,
    })

    const sessionToken =
      typeof result.data?.session_token === 'string'
        ? result.data.session_token
        : null
    if (result.status !== 'OK' || !sessionToken) {
      throw new Error('eID aggregator refused to start the session')
    }

    const controlCode =
      typeof result.data?.verification_control_code === 'string'
        ? result.data.verification_control_code
        : undefined

    return {
      sessionRef: sessionToken,
      ...(controlCode !== undefined ? { controlCode } : {}),
    }
  }

  async fetchStatus(sessionRef: string): Promise<EidEasyResponse> {
    return this.post('api/identity/status', {
      session_token: sessionRef,
    })
  }

  async status(sessionRef: string): Promise<{
    status: 'pending' | 'completed' | 'failed'
    user?: Record<string, unknown>
  }> {
    let result: EidEasyResponse
    try {
      result = await this.fetchStatus(sessionRef)
    } catch {
      // The status route does not catch; a network or HTTP error must
      // surface as a failed session, not a 500.
      return { status: 'failed' as const }
    }

    if (result.status === 'PENDING') {
      return { status: 'pending' as const }
    }
    if (result.status === 'COMPLETED' && result.data) {
      return { status: 'completed' as const, user: result.data }
    }
    return { status: 'failed' as const }
  }

  async complete(sessionRef: string): Promise<{
    user: Record<string, unknown>
    isikukood: string
  }> {
    const result = await this.fetchStatus(sessionRef)
    const isikukood =
      typeof result.data?.identifier === 'string'
        ? result.data.identifier
        : null

    if (result.status !== 'COMPLETED' || !result.data || !isikukood) {
      throw new Error('Session not completed')
    }

    return { user: result.data, isikukood }
  }
}

export function getEidProvider(method: EidMethod): EidProvider {
  const aggregator = getEidEasyConfig()
  if (aggregator) {
    // Stateless per request: all session state lives at the aggregator,
    // so any isolate can serve any poll or complete call.
    return new EidEasyProvider(aggregator, method)
  }
  // start, status, and complete arrive as separate HTTP requests, so the
  // demo simulator must be one shared instance or the session map is lost.
  return demoProvider
}

export async function completeEidLogin(
  method: EidMethod,
  sessionRef: string,
): Promise<NextResponse> {
  let isikukood: string
  try {
    const result = await getEidProvider(method).complete(sessionRef)
    isikukood = result.isikukood
  } catch {
    return NextResponse.json({ error: 'Session not completed' }, { status: 400 })
  }

  const repos = await getRepositories()
  const result = await repos.find({
    collection: 'users',
    where: { isikukoodHash: { equals: hash(isikukood) } },
    limit: 1,
  })
  const user = (result.docs[0] as Record<string, unknown> | undefined) ?? null

  if (!user || user.status === 'suspended') {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  const role = getUserRole(user.role as string | undefined)
  const { accessToken, refreshToken } = await createSession(
    String(user.id),
    role,
    user.profileId as string | undefined,
  )

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  })

  setSessionCookies(response, accessToken, refreshToken)

  return response
}

import crypto from 'node:crypto'
import { NextResponse } from 'next/server'

import { createSession, setSessionCookies } from '@/lib/auth/session'
import { hash } from '@/lib/crypto'
import { getUserRole } from '@/payload/access/roles'
import { getPayloadClient } from '@/payload/payloadClient'

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

const DEMO_PROFILES: Array<Record<string, unknown>> = [
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

  async start(
    isikukood: string,
  ): Promise<{ sessionRef: string; controlCode?: string }> {
    const user = buildDemoUsers()[isikukood]
    if (!user) {
      throw new Error('Unknown isikukood')
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

    return { sessionRef, controlCode }
  }

  async status(
    sessionRef: string,
  ): Promise<{ status: 'pending' | 'completed' | 'failed'; user?: Record<string, unknown> }> {
    const session = this.sessions.get(sessionRef)
    if (!session) {
      return { status: 'failed' }
    }

    session.pollCount++

    if (session.pollCount >= 2) {
      session.status = 'completed'
      return { status: 'completed', user: session.user }
    }

    return { status: 'pending' }
  }

  async complete(sessionRef: string): Promise<{
    user: Record<string, unknown>
    isikukood: string
  }> {
    const session = this.sessions.get(sessionRef)
    if (!session || session.status !== 'completed') {
      throw new Error('Session not completed')
    }

    this.sessions.delete(sessionRef)

    return { user: session.user, isikukood: session.isikukood }
  }
}

const demoProvider = new DemoEidProvider()

export function getEidProvider(_method: EidMethod): EidProvider {
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

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'users',
    where: { isikukoodHash: { equals: hash(isikukood) } },
    limit: 1,
    depth: 1,
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

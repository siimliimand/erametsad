import crypto from 'node:crypto'

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
  complete(sessionRef: string): Promise<{ user: Record<string, unknown> }>
}

const DEMO_USERS: Record<string, Record<string, unknown>> = {
  '38803160272': {
    id: 'demo-001',
    email: 'jaan@example.com',
    name: 'Jaan Tamm',
    role: 'private',
  },
  '47012130215': {
    id: 'demo-002',
    email: 'mari@example.com',
    name: 'Mari Laan',
    role: 'private',
  },
  '60001010205': {
    id: 'demo-003',
    email: 'toivo@example.com',
    name: 'Toivo Kuusk',
    role: 'company',
  },
}

export class DemoEidProvider implements EidProvider {
  private sessions = new Map<string, EidSession>()

  start(
    isikukood: string,
  ): Promise<{ sessionRef: string; controlCode?: string }> {
    const user = DEMO_USERS[isikukood]
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

    return Promise.resolve({ sessionRef, controlCode })
  }

  status(
    sessionRef: string,
  ): Promise<{ status: 'pending' | 'completed' | 'failed'; user?: Record<string, unknown> }> {
    const session = this.sessions.get(sessionRef)
    if (!session) {
      return Promise.resolve({ status: 'failed' })
    }

    session.pollCount++

    if (session.pollCount >= 2) {
      session.status = 'completed'
      return Promise.resolve({ status: 'completed', user: session.user })
    }

    return Promise.resolve({ status: 'pending' })
  }

  complete(sessionRef: string): Promise<{ user: Record<string, unknown> }> {
    const session = this.sessions.get(sessionRef)
    if (!session?.status || session.status !== 'completed') {
      throw new Error('Session not completed')
    }

    return Promise.resolve({ user: session.user })
  }
}

export function getEidProvider(_method: 'smartid' | 'mobileid' | 'idcard'): EidProvider {
  return new DemoEidProvider()
}
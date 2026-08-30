import type { PhaseName, RequestRecord } from './stats'

export interface VirtualUser {
  index: number
  email: string
  token: string
  /** Spoofed client IP: distinct per VU so the login rate limiter (5/min per IP) sees one bucket each. */
  ip: string
}

export interface ClientConfig {
  base: string
  timeoutMs: number
}

export interface BidPlan {
  vu: VirtualUser
  amountCents: number
  idempotencyKey: string
}

export interface PhaseResult {
  records: RequestRecord[]
  wallMs: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function vuIp(index: number): string {
  return `10.77.${String(Math.floor(index / 250) + 1)}.${String((index % 250) + 1)}`
}

async function postJson(
  cfg: ClientConfig,
  path: string,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string>,
): Promise<{
  status: number
  json: Record<string, unknown> | null
  latencyMs: number
}> {
  const startedAt = performance.now()
  const response = await fetch(`${cfg.base}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(cfg.timeoutMs),
  })
  const latencyMs = performance.now() - startedAt
  let json: Record<string, unknown> | null = null
  try {
    json = (await response.json()) as Record<string, unknown>
  } catch {
    json = null
  }
  return { status: response.status, json, latencyMs }
}

function extractCookie(responseHeaders: Headers, name: string): string | null {
  for (const cookie of responseHeaders.getSetCookie()) {
    const firstPair = cookie.split(';')[0]?.trim()
    if (firstPair?.startsWith(`${name}=`)) {
      return firstPair.slice(name.length + 1)
    }
  }
  return null
}

export async function login(
  cfg: ClientConfig,
  email: string,
  password: string,
  vuIndex: number,
): Promise<VirtualUser> {
  const response = await fetch(`${cfg.base}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': vuIp(vuIndex),
    },
    body: JSON.stringify({ identifier: email, password }),
    signal: AbortSignal.timeout(cfg.timeoutMs),
  })
  if (response.status !== 200) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `login failed for ${email}: ${String(response.status)} ${text}`,
    )
  }
  const token = extractCookie(response.headers, 'access_token')
  if (!token) throw new Error(`login for ${email} set no access_token cookie`)
  return { index: vuIndex, email, token, ip: vuIp(vuIndex) }
}

/** The seeded settings gate open bids behind a signed framework contract per user. */
export async function signFrameworkContract(
  cfg: ClientConfig,
  vu: VirtualUser,
  auctionId: string,
): Promise<void> {
  const headers = {
    cookie: `access_token=${vu.token}`,
    'x-forwarded-for': vu.ip,
  }
  const prepared = await postJson(
    cfg,
    '/api/v1/bids/framework-contract/prepare',
    { auctionId },
    headers,
  )
  const contractId =
    prepared.json !== null && typeof prepared.json.id === 'string'
      ? prepared.json.id
      : null
  if (prepared.status !== 201 || contractId === null) {
    throw new Error(
      `framework contract prepare failed for ${vu.email}: ${String(prepared.status)}`,
    )
  }
  const completed = await postJson(
    cfg,
    '/api/v1/bids/framework-contract/complete',
    { contractId },
    headers,
  )
  if (completed.status !== 200) {
    throw new Error(
      `framework contract complete failed for ${vu.email}: ${String(completed.status)}`,
    )
  }
}

export async function placeBid(
  cfg: ClientConfig,
  phase: PhaseName,
  auctionId: string,
  plan: BidPlan,
): Promise<RequestRecord> {
  const base: RequestRecord = {
    phase,
    vu: plan.vu.index,
    amountCents: plan.amountCents,
    idempotencyKey: plan.idempotencyKey,
    status: 0,
    latencyMs: 0,
    accepted: false,
    error: undefined,
  }
  try {
    const result = await postJson(
      cfg,
      '/api/v1/bids/create',
      {
        auctionId,
        amount: plan.amountCents / 100,
        type: 'open',
        idempotencyKey: plan.idempotencyKey,
      },
      {
        cookie: `access_token=${plan.vu.token}`,
        'x-forwarded-for': plan.vu.ip,
      },
    )
    return {
      ...base,
      status: result.status,
      latencyMs: Number(result.latencyMs.toFixed(1)),
      accepted: result.status === 201,
      error:
        result.status === 201 || result.json === null
          ? undefined
          : typeof result.json.error === 'string'
            ? result.json.error
            : undefined,
    }
  } catch (error) {
    return {
      ...base,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Executes a worker pool when rampMs is absent (trickle) or a
 * stagger-determined fan-out when rampMs is set (burst): plan i fires at
 * i*rampMs, all of them outstanding at once when rampMs is 0.
 */
export async function executePlans(
  cfg: ClientConfig,
  phase: PhaseName,
  auctionId: string,
  plans: readonly BidPlan[],
  opts: { concurrency: number; rampMs?: number | undefined },
): Promise<PhaseResult> {
  if (plans.length === 0) return { records: [], wallMs: 0 }
  const startedAt = performance.now()

  if (opts.rampMs !== undefined) {
    const rampMs = opts.rampMs
    const records = await Promise.all(
      plans.map(async (plan, index) => {
        const dueAt = index * rampMs
        const wait = dueAt - (performance.now() - startedAt)
        if (wait > 0) await sleep(wait)
        return placeBid(cfg, phase, auctionId, plan)
      }),
    )
    return { records, wallMs: performance.now() - startedAt }
  }

  const queue = [...plans]
  const records: RequestRecord[] = []
  async function worker(): Promise<void> {
    for (;;) {
      const plan = queue.shift()
      if (plan === undefined) return
      records.push(await placeBid(cfg, phase, auctionId, plan))
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.max(1, Math.min(opts.concurrency, queue.length)) },
      () => worker(),
    ),
  )
  return { records, wallMs: performance.now() - startedAt }
}

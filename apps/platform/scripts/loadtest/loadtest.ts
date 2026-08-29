/* eslint-disable no-console */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { getAuction, openD1, resetAuctionForRun, type D1Connection } from './d1'
import {
  executePlans,
  login,
  signFrameworkContract,
  type BidPlan,
  type ClientConfig,
  type VirtualUser,
} from './runner'
import {
  formatPhaseLine,
  summarizeRun,
  type RunSummary,
  type RequestRecord,
} from './stats'
import { verifyRun } from './verify'

const SCRIPT_DIR = fileURLToPath(new URL('./', import.meta.url))
const APP_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DEFAULT_RUN_FILE = `${SCRIPT_DIR}last-run.json`

type CliValues = Record<string, string | boolean | string[] | undefined>

function parseCli(args: string[]): { command: string; values: CliValues } {
  const { positionals, values } = parseArgs({
    args,
    options: {
      base: { type: 'string' },
      auction: { type: 'string' },
      slug: { type: 'string' },
      vus: { type: 'string' },
      pool: { type: 'string' },
      password: { type: 'string' },
      trickle: { type: 'string' },
      'trickle-concurrency': { type: 'string' },
      burst: { type: 'string' },
      'ramp-ms': { type: 'string' },
      'timeout-ms': { type: 'string' },
      'close-in': { type: 'string' },
      'start-floor-euros': { type: 'string' },
      'step-euros': { type: 'string' },
      'skip-contracts': { type: 'boolean' },
      label: { type: 'string' },
      out: { type: 'string' },
      run: { type: 'string' },
      d1: { type: 'string' },
    },
    allowPositionals: true,
  })
  const command = positionals[0]
  if (!command || !['setup', 'run', 'verify'].includes(command)) {
    throw new Error(
      'usage: loadtest.ts <setup|run|verify> [options] (see README.md)',
    )
  }
  return { command, values }
}

function str(values: CliValues, key: string, fallback: string): string {
  const value = values[key]
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function num(values: CliValues, key: string, fallback: number): number {
  const value = values[key]
  if (typeof value !== 'string') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function setupCommand(values: CliValues): Promise<void> {
  const conn = openD1(
    str(values, 'd1', 'local') as 'local' | 'remote',
    APP_ROOT,
  )
  try {
    const slug = str(values, 'slug', 'raieoigus-rae')
    const auction =
      (await getAuction(conn, { slug })) ??
      (values.auction !== undefined
        ? await getAuction(conn, { id: str(values, 'auction', '') })
        : null)
    if (!auction) throw new Error(`auction not found (slug=${slug})`)
    if (auction.type !== 'open')
      throw new Error('load test targets an open auction')
    const closeIn = num(values, 'close-in', 90)
    const { endsAt } = await resetAuctionForRun(conn, auction.id, closeIn)
    console.log(
      `setup ok: auction=${auction.id} slug=${auction.slug} min_bid_cents=${String(auction.min_bid_cents)} bid_step_cents=${String(auction.bid_step_cents)} ends_at=${endsAt}`,
    )
    console.log(
      'start wrangler dev now; the auction closes at ends_at (every accepted leading bid extends it by the anti-snipe window)',
    )
  } finally {
    conn.close()
  }
}

function buildUsers(
  pool: string[],
  vus: number,
): { email: string; vuIndex: number }[] {
  return Array.from({ length: vus }, (_, index) => ({
    email: pool[index % pool.length] ?? '',
    vuIndex: index,
  }))
}

function pickUser(users: VirtualUser[], index: number): VirtualUser {
  const user = users[index % users.length]
  if (!user) throw new Error('no logged-in virtual users')
  return user
}

function ladderPlans(
  users: VirtualUser[],
  firstIndex: number,
  count: number,
  startFloorCents: number,
  stepCents: number,
  runId: string,
): { plans: BidPlan[]; nextIndex: number } {
  const plans: BidPlan[] = []
  for (let i = 0; i < count; i++) {
    const index = firstIndex + i
    plans.push({
      vu: pickUser(users, index),
      amountCents: startFloorCents + stepCents * (index + 1),
      idempotencyKey: `${runId}-${String(index)}`,
    })
  }
  return { plans, nextIndex: firstIndex + count }
}

async function runCommand(values: CliValues): Promise<number> {
  const base = str(values, 'base', 'http://localhost:8787')
  const cfg: ClientConfig = {
    base,
    timeoutMs: num(values, 'timeout-ms', 30_000),
  }
  const vus = Math.max(1, num(values, 'vus', 24))
  const pool = str(
    values,
    'pool',
    'guest@eametsad.ee,private@eametsad.ee,company@eametsad.ee',
  ).split(',')
  const password = str(values, 'password', 'demo1234')
  const trickle = Math.max(0, num(values, 'trickle', 25))
  const trickleConcurrency = Math.max(1, num(values, 'trickle-concurrency', 1))
  const burst = Math.max(0, num(values, 'burst', 150))
  const rampMs = Math.max(0, num(values, 'ramp-ms', 0))
  const label = str(values, 'label', `run-${new Date().toISOString()}`)
  const outPath = str(values, 'out', DEFAULT_RUN_FILE)

  // Empty-string flags must fall through to the D1 lookup: Number('') is 0,
  // which would silently pin the ladder to 0-cent bids.
  const rawFloor = values['start-floor-euros']
  const explicitFloor =
    typeof rawFloor === 'string' && rawFloor.length > 0
      ? Number(rawFloor)
      : Number.NaN
  const rawStep = values['step-euros']
  const explicitStep =
    typeof rawStep === 'string' && rawStep.length > 0
      ? Number(rawStep)
      : Number.NaN
  let auctionId = str(values, 'auction', '')
  let startFloorCents = Number.isFinite(explicitFloor)
    ? Math.round(explicitFloor * 100)
    : Number.NaN
  let stepCents = Number.isFinite(explicitStep)
    ? Math.round(explicitStep * 100)
    : Number.NaN
  const needsD1 =
    auctionId.length === 0 ||
    !Number.isFinite(startFloorCents) ||
    !Number.isFinite(stepCents)
  let conn: D1Connection | null = null
  if (needsD1) {
    conn = openD1(str(values, 'd1', 'local') as 'local' | 'remote', APP_ROOT)
    const auction = await getAuction(conn, {
      ...(auctionId.length > 0 ? { id: auctionId } : {}),
      ...(auctionId.length === 0
        ? { slug: str(values, 'slug', 'raieoigus-rae') }
        : {}),
    })
    if (!auction)
      throw new Error('auction not found; pass --auction <id> or --slug')
    auctionId = auction.id
    if (!Number.isFinite(stepCents)) {
      stepCents =
        auction.bid_step_cents ?? Math.round(auction.min_bid_cents * 0.05)
    }
    if (!Number.isFinite(startFloorCents)) {
      const floorRows = await conn.all<{ floor: number | null }>(
        'SELECT MAX(amount_cents) AS floor FROM bids WHERE auction_id = ?',
        [auctionId],
      )
      const floor = floorRows[0]?.floor
      startFloorCents = floor ?? auction.min_bid_cents
    }
  }

  const runId = `lt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  console.log(
    `run ${label}: base=${base} auction=${auctionId} vus=${String(vus)} pool=${pool.join(',')} trickle=${String(trickle)} burst=${String(burst)} ramp_ms=${String(rampMs)} floor_cents=${String(startFloorCents)} step_cents=${String(stepCents)}`,
  )

  console.log(
    `logging in ${String(vus)} virtual users (distinct spoofed IPs for the auth rate limiter)`,
  )
  const users: VirtualUser[] = []
  for (const { email, vuIndex } of buildUsers(pool, vus)) {
    users.push(await login(cfg, email, password, vuIndex))
  }

  if (values['skip-contracts'] !== true) {
    const seen = new Set<string>()
    for (const user of users) {
      if (seen.has(user.email)) continue
      seen.add(user.email)
      await signFrameworkContract(cfg, user, auctionId)
    }
    console.log(`framework contracts signed for ${String(seen.size)} users`)
  }

  const records: RequestRecord[] = []
  const first = ladderPlans(
    users,
    0,
    trickle,
    startFloorCents,
    stepCents,
    runId,
  )
  const trickleResult =
    first.plans.length > 0
      ? await executePlans(cfg, 'trickle', auctionId, first.plans, {
          concurrency: trickleConcurrency,
        })
      : { records: [], wallMs: 0 }
  records.push(...trickleResult.records)

  const second = ladderPlans(
    users,
    first.nextIndex,
    burst,
    startFloorCents,
    stepCents,
    runId,
  )
  const burstResult =
    second.plans.length > 0
      ? await executePlans(cfg, 'burst', auctionId, second.plans, {
          concurrency: second.plans.length,
          rampMs,
        })
      : { records: [], wallMs: 0 }
  records.push(...burstResult.records)

  const walls = { trickleMs: trickleResult.wallMs, burstMs: burstResult.wallMs }
  const summary: RunSummary = {
    label,
    base,
    auctionId,
    runId,
    startedAt: new Date().toISOString(),
    config: {
      vus,
      pool,
      trickle,
      trickleConcurrency,
      burst,
      rampMs,
      timeoutMs: cfg.timeoutMs,
      startFloorCents,
      stepCents,
    },
    records,
    walls,
    summary: summarizeRun(records, walls),
  }
  await writeFile(outPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

  console.log(
    `phase   n     acc  rej  err  latency          rps     [status histogram]`,
  )
  console.log(formatPhaseLine(summary.summary.trickle))
  console.log(formatPhaseLine(summary.summary.burst))
  console.log(
    `totals: accepted=${String(summary.summary.totalAccepted)} rejected=${String(summary.summary.totalRejected)} errors=${String(summary.summary.totalErrors)} max_accepted_cents=${String(summary.summary.maxAcceptedAmountCents)}`,
  )
  console.log(`run summary written to ${outPath} (idempotency prefix ${runId})`)
  console.log(
    `verify with: pnpm exec tsx scripts/loadtest/loadtest.ts verify --run ${outPath}`,
  )

  conn?.close()
  return summary.summary.totalErrors === 0 ? 0 : 1
}

async function verifyCommand(values: CliValues): Promise<number> {
  const runPath = str(values, 'run', DEFAULT_RUN_FILE)
  const run = JSON.parse(await readFile(runPath, 'utf8')) as RunSummary
  const conn = openD1(
    str(values, 'd1', 'local') as 'local' | 'remote',
    APP_ROOT,
  )
  try {
    const checks = await verifyRun(conn, run)
    let failed = 0
    for (const check of checks) {
      console.log(
        `${check.pass ? 'PASS' : 'FAIL'}  ${check.name}: ${check.detail}`,
      )
      if (!check.pass) failed++
    }
    console.log(
      failed === 0
        ? `all ${String(checks.length)} checks passed for ${run.runId}`
        : `${String(failed)} of ${String(checks.length)} checks FAILED for ${run.runId}`,
    )
    return failed === 0 ? 0 : 1
  } finally {
    conn.close()
  }
}

async function main(): Promise<number> {
  const { command, values } = parseCli(process.argv.slice(2))
  if (command === 'setup') {
    await setupCommand(values)
    return 0
  }
  if (command === 'run') return runCommand(values)
  return verifyCommand(values)
}

main().then(
  (code) => {
    process.exit(code)
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  },
)

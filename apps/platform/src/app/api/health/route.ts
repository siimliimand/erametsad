import { NextResponse } from 'next/server'

export const runtime = 'edge'

export function GET() {
  const env = (globalThis as Record<string, unknown>).env as Record<string, unknown> | undefined

  if (!env) {
    return NextResponse.json({ status: 'ok' })
  }

  return NextResponse.json({
    status: 'ok',
    env: 'production',
    bindings: {
      queue: !!env.QUEUE,
      kv: !!env.KV,
      r2: !!env.BUCKET,
    },
  })
}
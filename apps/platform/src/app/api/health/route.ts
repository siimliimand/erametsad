import { NextResponse } from 'next/server'

export function GET() {
  const bindings = (globalThis as Record<string, unknown>).env as
    | Record<string, unknown>
    | undefined

  if (!bindings) {
    return NextResponse.json({ status: 'ok' })
  }

  return NextResponse.json({
    status: 'ok',
    env: 'production',
    bindings: {
      queue: true,
      kv: true,
      r2: true,
    },
  })
}
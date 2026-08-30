import type { Metadata } from 'next'

import { LoginForm } from './_components/LoginForm'

export const metadata: Metadata = {
  title: 'Logi sisse',
}

// Same rule as (portal)/_lib/session.ts: only local absolute paths travel
// through ?next=; the protocol-relative //host form is an open redirect.
function safeNext(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null
  }
  return value
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const next = safeNext((await searchParams).next)

  return <LoginForm next={next} />
}

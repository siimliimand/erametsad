import type { Metadata } from 'next'

import { LoginForm } from './_components/LoginForm'

import { marketingUrl } from '@/app/(marketing)/_lib/base-url'

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

  // Same destination as the portal footer's "Privaatsuspoliitika" link.
  const privacyHref = marketingUrl('/lepingud/dokumendid')

  return <LoginForm next={next} privacyHref={privacyHref} />
}

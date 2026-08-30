import type { Metadata } from 'next'

import { RegisterWizard } from './_components/RegisterWizard'

export const metadata: Metadata = {
  title: 'Loo konto',
}

// Same rule as (portal)/login/page.tsx: only local absolute paths travel
// through ?next=; the protocol-relative //host form is an open redirect.
function safeNext(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null
  }
  return value
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const next = safeNext((await searchParams).next)

  return <RegisterWizard next={next} />
}

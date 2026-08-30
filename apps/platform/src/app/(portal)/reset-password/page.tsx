import type { Metadata } from 'next'

import { PasswordResetRequestForm } from '../_components/PasswordForm'

export const metadata: Metadata = {
  title: 'Parooli taastamine',
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

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const next = safeNext((await searchParams).next)

  return (
    <div className="mx-auto w-full max-w-container-sm">
      <div className="rounded-card border border-border bg-bgPage p-md shadow-card md:p-lg">
        <h1 className="font-heading text-h2 text-ink">Parooli taastamine</h1>
        <p className="mt-2xs font-body text-body text-inkMuted">
          Unustasid parooli? Sisesta isikukood või e-posti aadress ja saadame
          sulle taastamislingi.
        </p>

        <div className="mt-md">
          <PasswordResetRequestForm next={next} />
        </div>
      </div>
    </div>
  )
}

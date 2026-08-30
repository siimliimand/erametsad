import type { Metadata } from 'next'
import Link from 'next/link'

import { PasswordForm } from '../../_components/PasswordForm'

export const metadata: Metadata = {
  title: 'Määra uus parool',
}

export default async function ResetPasswordTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <div className="mx-auto w-full max-w-container-sm">
      <div className="rounded-card border border-border bg-bgPage p-md shadow-card md:p-lg">
        <h1 className="font-heading text-h2 text-ink">Määra uus parool</h1>
        <p className="mt-2xs font-body text-body text-inkMuted">
          Vali uus parool. Parooli lähtestamisel suletakse kõik teised
          sessioonid.
        </p>

        <div className="mt-md">
          <PasswordForm
            endpoint="/api/v1/auth/reset-password"
            buildBody={({ newPassword }) => ({ token, password: newPassword })}
            submitLabel="Määra parool"
            fallbackError="Parooli lähtestamine ei õnnestunud. Proovi uuesti."
            errorFooter={
              <p className="font-body text-bodySm text-inkMuted">
                Link on aegunud, juba kasutatud või vigane?{' '}
                <Link
                  href="/reset-password"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Taotle uus lähtestamislink
                </Link>
                .
              </p>
            }
            successTitle="Parool on lähtestatud"
            successNote={
              <p className="font-body text-body text-inkMuted">
                Turvakaalutlustel suleti kõik teised sessioonid.{' '}
                <Link
                  href="/login"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Logi sisse uue parooliga
                </Link>
                .
              </p>
            }
          />
        </div>
      </div>
    </div>
  )
}

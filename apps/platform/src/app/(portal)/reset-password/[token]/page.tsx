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
    <div className="flex w-full justify-center">
      <div className="w-full max-w-[480px] rounded-card border border-border bg-bgPage p-md shadow-card md:p-lg">
        <h1 className="font-heading text-[2rem] font-extrabold leading-tight text-ink">
          Määra uus parool
        </h1>
        <p className="mt-1.5 font-body text-bodySm text-inkMuted">
          Vali uus parool. Parooli lähtestamisel suletakse kõik teised
          sessioonid.
        </p>

        <div className="mt-6">
          <PasswordForm
            endpoint="/api/v1/auth/reset-password"
            resetToken={token}
            withRepeatPassword
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
              <div className="mt-1 flex w-full flex-col gap-2">
                <p className="font-body text-bodySm text-inkMuted">
                  Turvakaalutlustel suleti kõik teised sessioonid.
                </p>
                <Link
                  href="/login"
                  className="inline-flex h-12 w-full items-center justify-center rounded-button bg-primary font-label font-semibold text-ink-inverse transition-colors duration-hover ease-hover hover:bg-primary-hover motion-reduce:transition-none"
                >
                  Logi sisse uue parooliga
                </Link>
                <Link
                  href="/"
                  className="inline-flex h-12 w-full items-center justify-center rounded-button border border-primary bg-transparent font-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primary-light motion-reduce:transition-none"
                >
                  Avalehele
                </Link>
              </div>
            }
          />
        </div>
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'

import { PasswordForm } from '../_components/PasswordForm'

import { requirePortalSession } from '@/app/(portal)/_lib/session'
import { getRepositories } from '@/lib/data/runtime'

interface UpdatePasswordPageProps {
  searchParams: Promise<{ first?: string | string[] }>
}

function isFirstPassword(searchParams: { first?: string | string[] }): boolean {
  const value = Array.isArray(searchParams.first)
    ? searchParams.first[0]
    : searchParams.first
  return value === '1'
}

export async function generateMetadata({
  searchParams,
}: UpdatePasswordPageProps): Promise<Metadata> {
  return {
    title: isFirstPassword(await searchParams) ? 'Määra parool' : 'Muuda parool',
  }
}

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const { session } = await requirePortalSession('/update-password')
  const first = isFirstPassword(await searchParams)
  const heading = first ? 'Määra parool' : 'Muuda parool'

  // Unguarded like the change-password route: the users collection is
  // admin-only under the guard, but a viewer may always read their own record.
  const repos = await getRepositories()
  const user = await repos.findByID({ collection: 'users', id: session.userId })

  return (
    <div className="mx-auto w-full max-w-container-sm">
      <div className="rounded-card border border-border bg-bgPage p-md shadow-card md:p-lg">
        <h1 className="font-heading text-h2 text-ink">{heading}</h1>
        <p className="mt-2xs font-body text-body text-inkMuted">
          {first
            ? 'Sinu konto on loodud eID kaudu ja parool puudub. Määra parool, et hiljem sisse logida ka parooliga.'
            : 'Vaheta oma konto parool.'}
        </p>

        <div className="mt-md">
          <PasswordForm
            endpoint="/api/v1/auth/change-password"
            isikukood={user?.isikukood ?? null}
            buildBody={
              first
                ? ({ newPassword }) => ({ newPassword })
                : ({ currentPassword, newPassword }) => ({
                    oldPassword: currentPassword,
                    newPassword,
                  })
            }
            withCurrentPassword={!first}
            submitLabel={heading}
            fallbackError="Parooli muutmine ei õnnestunud. Proovi uuesti."
            errorFooter={
              <p className="font-body text-bodySm text-inkMuted">
                Ei tea praegust parooli?{' '}
                <Link
                  href="/reset-password"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Taotle lähtestamislink e-postile
                </Link>
                .
              </p>
            }
            successTitle={first ? 'Parool on määratud' : 'Parool on muudetud'}
            successNote={
              <p className="font-body text-body text-inkMuted">
                Kõik sinu sessioonid on suletud.{' '}
                <Link
                  href="/login"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Logi uue parooliga uuesti sisse
                </Link>
                .
              </p>
            }
          />
        </div>

        <p className="mt-md font-body text-bodySm text-inkMuted">
          Parooli muutmisel suletakse kõik aktiivsed sessioonid, sealhulgas
          see seade. Pead seejärel uuesti sisse logima.
        </p>
      </div>
    </div>
  )
}

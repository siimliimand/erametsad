import { Info } from 'lucide-react'
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

// Demo confirmation note masks the address: keep the first local-part
// character and the domain.
function maskEmail(email: string): string {
  const atIndex = email.indexOf('@')
  if (atIndex <= 0) return '••••'
  return `${email.slice(0, 1)}••••@${email.slice(atIndex + 1)}`
}

export async function generateMetadata({
  searchParams,
}: UpdatePasswordPageProps): Promise<Metadata> {
  return {
    title: isFirstPassword(await searchParams) ? 'Määra parool' : 'Parooli muutmine',
  }
}

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const { session } = await requirePortalSession('/update-password')
  const first = isFirstPassword(await searchParams)
  const heading = first ? 'Määra parool' : 'Parooli muutmine'

  // Unguarded like the change-password route: the users collection is
  // admin-only under the guard, but a viewer may always read their own record.
  const repos = await getRepositories()
  const user = await repos.findByID({ collection: 'users', id: session.userId })
  const email = typeof user?.email === 'string' ? user.email : null

  return (
    <div className="flex w-full justify-center">
      <div className="w-full max-w-[480px] rounded-card border border-border bg-bgPage p-md shadow-card md:p-lg">
        <h1 className="font-heading text-[2rem] font-extrabold leading-tight text-ink">
          {heading}
        </h1>
        <p className="mt-1.5 font-body text-bodySm text-inkMuted">
          {first
            ? 'Sinu konto on loodud eID kaudu ja parool puudub. Määra parool, et hiljem sisse logida ka parooliga.'
            : 'Uuenda oma konto parooli. Pärast salvestamist logitakse teised seadmed turvalisuse huvides välja ja saadame kinnituse e-postile.'}
        </p>

        <p className="mb-6 mt-4 flex items-start gap-2.5 rounded-button bg-infoLight px-3.5 py-3 font-body text-bodySm leading-relaxed text-info">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            eID (ID-kaart, Mobiil-ID või Smart-ID) on peamine sisselogimisviis
            — parool on ainult varuviis.
          </span>
        </p>

        <PasswordForm
          endpoint="/api/v1/auth/change-password"
          isikukood={user?.isikukood ?? null}
          withCurrentPassword={!first}
          withRepeatPassword
          submitLabel={first ? 'Määra parool' : 'Salvesta uus salasõna'}
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
          successTitle={first ? 'Parool on määratud' : 'Parool on uuendatud'}
          successNote={
            <div className="mt-1 flex w-full flex-col gap-2">
              <p className="font-body text-bodySm text-inkMuted">
                {email
                  ? `Saatsime kinnituse e-postile ${maskEmail(email)}. Turvalisuse huvides logiti kõik teised seadmed välja.`
                  : 'Turvalisuse huvides logiti kõik teised seadmed välja.'}
              </p>
              <Link
                href="/login"
                className="inline-flex h-12 w-full items-center justify-center rounded-button bg-primary font-label font-semibold text-ink-inverse transition-colors duration-hover ease-hover hover:bg-primary-hover motion-reduce:transition-none"
              >
                Logi sisse
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
  )
}

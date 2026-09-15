'use client'

import Link from 'next/link'

import { ArrowRightIcon, CircleCheckIcon } from './icons'

interface StepDoneProps {
  next: string | null
  displayName: string
  profileType: 'private' | 'company'
  approvalStatus: string
}

const ctaLinkClass =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-button bg-cta font-label font-semibold text-ink transition-colors duration-hover ease-hover hover:bg-cta-hover motion-reduce:transition-none'

const ghostLinkClass =
  'inline-flex h-12 w-full items-center justify-center rounded-button bg-transparent font-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primary-light motion-reduce:transition-none'

// Demo success view (06-register.html .auth-success): big check, "Konto
// loodud!", greeting, and the onward links required by the auth spec.
export function StepDone({ next, displayName, profileType, approvalStatus }: StepDoneProps) {
  const companyPending = profileType === 'company' && approvalStatus !== 'approved'
  const selectProfileHref = next
    ? `/select-profile?next=${encodeURIComponent(next)}`
    : '/select-profile'
  const backHref = next ?? '/'

  return (
    <section aria-label="Konto on loodud" className="flex flex-col items-center gap-1 py-2 text-center">
      <CircleCheckIcon className="h-[52px] w-[52px] text-accent" aria-hidden="true" />
      <h2 className="mt-2 font-heading text-[1.75rem] font-bold text-ink">Konto loodud!</h2>
      <p className="font-body text-body text-ink">
        {companyPending ? (
          <>Tere, <strong>{displayName}</strong>! Ettevõtte profiil ootab administraatori kinnitust.</>
        ) : (
          <>Tere, <strong>{displayName}</strong>! Sinu konto on loodud ja isik tuvastatud.</>
        )}
      </p>

      <p className="font-body text-bodySm text-inkMuted">
        {companyPending
          ? 'Saadame teavituse, kui profiil on heaks kiidetud. Pakkumiste õigused avanevad pärast kinnitamist.'
          : (
            <>
              Pakkumiste tegemiseks vajad vastava oksjonitüübi õigusi — allkirjasta{' '}
              <Link
                href="/lepingud/raamleping"
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                raamleping
              </Link>{' '}
              esimese pakkumise juures.
            </>
          )}
      </p>

      <p className="font-body text-bodySm text-inkMuted">
        Konto on loodud paroolita. Määra püsiv parool, et saad hiljem sisse
        logida ka parooliga.
      </p>

      <div className="mt-4 grid w-full max-w-[340px] gap-2.5">
        {/* Password first: registration is passwordless, so the issued
            session is the only window to set the first credential. */}
        <Link href="/update-password?first=1" className={ctaLinkClass}>
          Määra püsiv parool
          <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
        </Link>
        <Link href={selectProfileHref} className={ghostLinkClass}>
          Vali profiil ja jätka
        </Link>
        <Link href={backHref} className={ghostLinkClass}>
          Tagasi oksjonitele
        </Link>
      </div>
    </section>
  )
}

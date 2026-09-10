'use client'

import Link from 'next/link'
import { useState } from 'react'

import { AccessRequestFlow } from './AccessRequestFlow'
import { StepBar, type StepBarItem } from './StepBar'
import { StepContactConsents, type ContactConsentsData } from './StepContactConsents'
import { StepDone } from './StepDone'
import { StepIdentify } from './StepIdentify'
import { StepProfileType } from './StepProfileType'
import { submitRegistration, type CompanyLookupResult } from './register-client'

// The register contract validates a date for every consent key, but the
// optional marketing consent must not record a fake "now" when unchecked.
// It travels as the epoch sentinel instead; any pre-2000 value means
// "not consented".
const NO_CONSENT_SENTINEL = '1970-01-01T00:00:00.000Z'

interface RegisterWizardProps {
  next: string | null
}

export function RegisterWizard({ next }: RegisterWizardProps) {
  const [step, setStep] = useState(1)
  const [identity, setIdentity] = useState<{ email: string; isikukood: string } | null>(null)
  const [profileType, setProfileType] = useState<'private' | 'company'>('private')
  const [company, setCompany] = useState<{ regCode: string; companyName: string } | null>(null)
  const [deadEndCompany, setDeadEndCompany] = useState<CompanyLookupResult | null>(null)
  const [done, setDone] = useState<{ displayName: string; approvalStatus: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [existingAccount, setExistingAccount] = useState(false)

  // next is validated server-side in page.tsx and lives in component state,
  // so it survives every step without touching the URL.
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login'

  const stepItems: StepBarItem[] = [
    { id: 'identify', label: 'Tuvastus' },
    { id: 'profile', label: 'Profiili tüüp' },
    { id: 'contact', label: 'Andmed ja nõusolekud' },
    { id: 'done', label: 'Valmis' },
  ]

  function handleIdentified(identified: { email: string; isikukood: string }) {
    setIdentity(identified)
    setStep(2)
  }

  function handleProfileChoice(choice: {
    profileType: 'private' | 'company'
    company: { regCode: string; companyName: string } | null
  }) {
    setProfileType(choice.profileType)
    setCompany(choice.company)
    setStep(3)
  }

  async function handleRegister(data: ContactConsentsData) {
    if (!identity || busy) return
    setBusy(true)
    setServerError(null)
    setExistingAccount(false)

    const consentAt = new Date().toISOString()
    const result = await submitRegistration({
      identifier: data.email,
      isikukood: identity.isikukood,
      profileType,
      consents: {
        terms: consentAt,
        privacy: consentAt,
        marketing: data.consents.marketing ? consentAt : NO_CONSENT_SENTINEL,
      },
      phone: data.phone,
      address: data.address,
      ...(company
        ? { regCode: company.regCode, companyName: company.companyName }
        : {}),
    })

    setBusy(false)
    if (!result.ok) {
      setExistingAccount(result.existingAccount)
      setServerError(result.message)
      return
    }
    setDone({
      displayName: result.profile?.displayName ?? data.fullName,
      approvalStatus: result.profile?.approvalStatus ?? 'approved',
    })
    setStep(4)
  }

  return (
    <div className="mx-auto w-full max-w-[600px]">
      <div className="text-center">
        <h1 className="font-heading text-[1.75rem] font-extrabold leading-tight text-ink md:text-h2">
          Loo konto
        </h1>
        <p className="mt-1.5 font-body text-body text-inkMuted">
          Üks konto kõigiks Erametsadi oksjoniteks.
        </p>
      </div>

      <div className="mb-6 mt-6">
        <StepBar steps={stepItems} current={step} />
      </div>

      <div className="rounded-card border border-border bg-bgPage p-6 shadow-card md:p-8">
        {deadEndCompany ? (
          <AccessRequestFlow
            company={deadEndCompany}
            defaultEmail={identity?.email ?? null}
            next={next}
            onBack={() => { setDeadEndCompany(null); }}
          />
        ) : step === 1 ? (
          <StepIdentify
            onExistingAccount={() => { window.location.assign(loginHref); }}
            onFallbackContinue={handleIdentified}
          />
        ) : step === 2 ? (
          <StepProfileType
            onNext={handleProfileChoice}
            onRequestAccess={(found) => { setDeadEndCompany(found); }}
          />
        ) : step === 3 ? (
          <StepContactConsents
            profileType={profileType}
            company={company}
            identityEmail={identity?.email ?? ''}
            busy={busy}
            serverError={serverError}
            existingAccount={existingAccount}
            loginHref={loginHref}
            onSubmit={(data) => void handleRegister(data)}
          />
        ) : (
          done && (
            <StepDone
              next={next}
              displayName={done.displayName}
              profileType={profileType}
              approvalStatus={done.approvalStatus}
            />
          )
        )}
      </div>

      <p className="mt-[18px] text-center font-body text-bodySm text-inkMuted">
        Juba kasutaja?{' '}
        <Link
          href={loginHref}
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          Logi sisse
        </Link>
      </p>
    </div>
  )
}

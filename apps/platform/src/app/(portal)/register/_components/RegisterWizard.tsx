'use client'

import { Steps, type StepItem } from '@eametsad/ui'
import { useState } from 'react'

import { AccessRequestFlow } from './AccessRequestFlow'
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

  function stepStatus(index: number): StepItem['status'] {
    if (index < step) return 'completed'
    if (index === step) return 'current'
    return 'upcoming'
  }

  const stepItems: StepItem[] = [
    { id: 'identify', label: 'Tuvastus', status: stepStatus(1) },
    { id: 'profile', label: 'Profiili tüüp', status: stepStatus(2) },
    { id: 'contact', label: 'Andmed ja nõusolekud', status: stepStatus(3) },
    { id: 'done', label: 'Valmis', status: stepStatus(4) },
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
    <div className="mx-auto w-full max-w-container-sm">
      <div className="rounded-card border border-border bg-bgPage p-md shadow-card md:p-lg">
        <h1 className="font-heading text-h2 text-ink">Loo konto</h1>
        <p className="mt-2xs font-body text-body text-inkMuted">
          Nelja sammuga registreerimine oksjonikeskkonda.
        </p>

        <div className="mt-md">
          <Steps steps={stepItems} orientation="horizontal" />
        </div>

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
              target={next ?? '/'}
              displayName={done.displayName}
              profileType={profileType}
              approvalStatus={done.approvalStatus}
            />
          )
        )}
      </div>
    </div>
  )
}

'use client'

import { Btn, FormInput } from '@eametsad/ui'
import Link from 'next/link'
import { useState } from 'react'

import { sendAccessRequest, type CompanyLookupResult } from './register-client'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface AccessRequestFlowProps {
  company: CompanyLookupResult
  defaultEmail: string | null
  next: string | null
  onBack: () => void
}

export function AccessRequestFlow({
  company,
  defaultEmail,
  next,
  onBack,
}: AccessRequestFlowProps) {
  const [requesterName, setRequesterName] = useState('')
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login'

  async function handleSubmit() {
    const name = requesterName.trim()
    const mail = email.trim()
    if (!name) {
      setFieldError('Sisesta oma nimi.')
      return
    }
    if (!EMAIL_RE.test(mail)) {
      setFieldError('Sisesta korrektne e-posti aadress.')
      return
    }
    setFieldError(null)
    setServerError(null)
    setSending(true)
    const result = await sendAccessRequest({
      regCode: company.regCode,
      companyName: company.name,
      requesterName: name,
      requesterEmail: mail,
      ...(phone.trim() ? { requesterPhone: phone.trim() } : {}),
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    })
    setSending(false)
    if (!result.ok) {
      setServerError(result.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <section aria-label="Juurdepääsutaotlus on saadetud" className="mt-md flex flex-col gap-md">
        <div role="status" className="rounded-card border border-info bg-infoLight p-md">
          <p className="font-label font-semibold uppercase tracking-wide text-info">
            Juurdepääsutaotlus on saadetud
          </p>
          <p className="mt-2xs font-body text-body text-ink">
            Taotlus ettevõtte {company.name} juurdepääsuks on administraatoril
            menetluses. Saadame vastuse aadressile {email.trim()}.
          </p>
        </div>
        <p className="font-body text-bodySm text-inkMuted">
          Olemasolev konto?{' '}
          <Link
            href={loginHref}
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            Logi sisse
          </Link>
        </p>
      </section>
    )
  }

  return (
    <section aria-label="Juurdepääsu taotlemine" className="mt-md flex flex-col gap-md">
      <div className="flex flex-col gap-2xs">
        <h2 className="font-heading text-h3 text-ink">Taotle juurdepääsu</h2>
        <p className="font-body text-body text-inkMuted">
          Ettevõte {company.name} (registrikood {company.regCode}) on juba
          oksjonikeskkonnas. Uue profiili loomise asemel saad taotleda
          juurdepääsu olemasolevale profiilile. Taotlus vaatab üle
          administraator.
        </p>
      </div>

      <FormInput
        label="Sinu nimi"
        name="requester-name"
        autoComplete="name"
        value={requesterName}
        onChange={(event) => {
          setRequesterName(event.target.value)
        }}
      />

      <FormInput
        label="E-post"
        name="requester-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value)
        }}
      />

      <FormInput
        label="Telefon (valikuline)"
        name="requester-phone"
        type="tel"
        autoComplete="tel"
        value={phone}
        onChange={(event) => {
          setPhone(event.target.value)
        }}
      />

      <FormInput
        label="Põhjendus (valikuline)"
        name="requester-reason"
        hint="Näiteks sinu roll ettevõttes"
        value={reason}
        onChange={(event) => {
          setReason(event.target.value)
        }}
      />

      {fieldError && (
        <p role="alert" className="font-body text-bodySm text-danger">
          {fieldError}
        </p>
      )}

      {serverError && (
        <p role="alert" className="font-body text-bodySm text-danger">
          {serverError}
        </p>
      )}

      <div className="flex flex-wrap gap-sm">
        <Btn onClick={() => void handleSubmit()} isLoading={sending}>
          Saada taotlus
        </Btn>
        <Btn variant="ghost" onClick={onBack}>
          Tagasi
        </Btn>
      </div>
    </section>
  )
}

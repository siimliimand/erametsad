'use client'

import { EEPhone } from '@erametsad/types'
import { Btn, ConsentCheck, FormInput } from '@erametsad/ui'
import Link from 'next/link'
import { useState } from 'react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface ContactConsentsData {
  fullName: string
  email: string
  phone: string
  address: string
  consents: { terms: boolean; privacy: boolean; marketing: boolean }
}

interface StepContactConsentsProps {
  profileType: 'private' | 'company'
  company: { regCode: string; companyName: string } | null
  identityEmail: string
  busy: boolean
  serverError: string | null
  existingAccount: boolean
  loginHref: string
  onSubmit: (data: ContactConsentsData) => void
}

export function StepContactConsents({
  profileType,
  company,
  identityEmail,
  busy,
  serverError,
  existingAccount,
  loginHref,
  onSubmit,
}: StepContactConsentsProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState(identityEmail)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [consents, setConsents] = useState({
    terms: false,
    privacy: false,
    marketing: false,
  })
  const [nameError, setNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [termsError, setTermsError] = useState<string | null>(null)
  const [privacyError, setPrivacyError] = useState<string | null>(null)
  const [honeypot, setHoneypot] = useState('')
  const [honeypotError, setHoneypotError] = useState<string | null>(null)

  function handleSubmit() {
    // Honeypot tripped: bots fill the hidden field, so fail neutrally and
    // never reach the registration call (demo 06-register.html behavior).
    if (honeypot.trim() !== '') {
      setHoneypotError('Registreerimine ebaõnnestus. Proovi uuesti.')
      return
    }
    const nextNameError = fullName.trim() ? null : 'Sisesta ees- ja perekonnanimi.'
    const nextEmailError = EMAIL_RE.test(email.trim())
      ? null
      : 'Sisesta korrektne e-posti aadress.'
    const nextPhoneError = EEPhone.safeParse(phone.trim()).success
      ? null
      : 'Palun sisesta kehtiv Eesti telefoninumber (+372XXXXXXXX).'
    const nextTermsError = consents.terms
      ? null
      : 'Palun nõustu kasutustingimustega.'
    const nextPrivacyError = consents.privacy
      ? null
      : 'Palun nõustu privaatsuspoliitikaga.'
    setNameError(nextNameError)
    setEmailError(nextEmailError)
    setPhoneError(nextPhoneError)
    setTermsError(nextTermsError)
    setPrivacyError(nextPrivacyError)
    if (nextNameError || nextEmailError || nextPhoneError || nextTermsError || nextPrivacyError) {
      return
    }
    onSubmit({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      consents,
    })
  }

  return (
    <section aria-label="Kontaktandmed ja nõusolekud" className="flex flex-col gap-md">
      <div className="flex flex-col gap-2xs">
        <h2 className="font-heading text-h3 font-bold text-ink">Sisesta oma andmed</h2>
        <p className="font-body text-bodySm text-inkMuted">
          {profileType === 'company'
            ? `Ettevõte ${company?.companyName ?? ''} (registrikood ${company?.regCode ?? ''}). Sisesta oma kontaktandmed.`
            : 'Sisesta oma kontaktandmed ja anna nõusolekud.'}
        </p>
      </div>

      {existingAccount && (
        <p className="font-body text-bodySm text-ink">
          See e-posti aadress on juba kasutusel.{' '}
          <Link
            href={loginHref}
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            Logi sisse olemasoleva kontoga
          </Link>
          .
        </p>
      )}

      {serverError && (
        <p role="alert" className="font-body text-bodySm text-danger">
          {serverError}
        </p>
      )}

      {honeypotError && (
        <p role="alert" className="font-body text-bodySm text-danger">
          {honeypotError}
        </p>
      )}

      <FormInput
        label="Ees- ja perekonnanimi"
        name="contact-name"
        autoComplete="name"
        {...(nameError ? { error: nameError } : {})}
        value={fullName}
        onChange={(event) => {
          setFullName(event.target.value)
        }}
      />

      <FormInput
        label="E-post"
        name="contact-email"
        type="email"
        autoComplete="email"
        hint="Kontole sisselogimiseks ja teavitusteks"
        {...(emailError ? { error: emailError } : {})}
        value={email}
        onChange={(event) => {
          setEmail(event.target.value)
        }}
      />

      <FormInput
        label="Telefon"
        name="contact-phone"
        type="tel"
        autoComplete="tel"
        hint="Kujul +372XXXXXXXX"
        {...(phoneError ? { error: phoneError } : {})}
        value={phone}
        onChange={(event) => {
          setPhone(event.target.value)
        }}
      />

      <FormInput
        label="Aadress"
        name="contact-address"
        autoComplete="street-address"
        value={address}
        onChange={(event) => {
          setAddress(event.target.value)
        }}
      />

      <div className="mt-2xs flex flex-col gap-sm">
        <ConsentCheck
          name="consent-terms"
          label="Nõustun kasutustingimustega. (kohustuslik)"
          {...(termsError ? { error: termsError } : {})}
          onChange={(checked) => {
            setConsents((current) => ({ ...current, terms: checked }))
            if (checked) setTermsError(null)
          }}
        />

        <ConsentCheck
          name="consent-privacy"
          label="Nõustun privaatsuspoliitikaga. (kohustuslik)"
          {...(privacyError ? { error: privacyError } : {})}
          onChange={(checked) => {
            setConsents((current) => ({ ...current, privacy: checked }))
            if (checked) setPrivacyError(null)
          }}
        />

        <ConsentCheck
          name="consent-marketing"
          label="Soovin teavitusi uutest oksjonitest (valikuline)."
          onChange={(checked) => {
            setConsents((current) => ({ ...current, marketing: checked }))
          }}
        />
      </div>

      {/* Honeypot: bots fill this, humans never see it (demo .hp-field). */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="register-website">Ära täida seda välja</label>
        <input
          id="register-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => {
            setHoneypot(event.target.value)
          }}
        />
      </div>

      <Btn variant="cta" onClick={handleSubmit} isLoading={busy}>
        Loo konto
      </Btn>
    </section>
  )
}

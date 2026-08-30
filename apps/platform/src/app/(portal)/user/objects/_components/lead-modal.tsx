'use client'

import { EEPhone } from '@eametsad/types'
import { Btn, ConsentCheck, FormInput, Modal } from '@eametsad/ui'
import { useState, type SyntheticEvent } from 'react'

import { ApiError, requestJson } from './api'

interface LeadModalProps {
  isOpen: boolean
  onClose: () => void
  profileName: string | null
}

const HONEYPOT_FIELD = 'company_website'

function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function LeadModal({ isOpen, onClose, profileName }: LeadModalProps) {
  const [contactName, setContactName] = useState(profileName ?? '')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [cadastr, setCadastr] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    onClose()
    if (done) {
      setContactName(profileName ?? '')
      setPhone('')
      setEmail('')
      setCadastr('')
      setConsent(false)
      setDone(false)
    }
    setFieldErrors({})
    setError(null)
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const errors: Record<string, string> = {}
    if (contactName.trim() === '') errors.contactName = 'Nimi on kohustuslik'
    if (phone.trim() === '') {
      errors.phone = 'Telefon on kohustuslik'
    } else if (!EEPhone.safeParse(phone.trim()).success) {
      errors.phone = 'Palun sisestage kehtiv Eesti telefoninumber.'
    }
    if (email.trim() === '') {
      errors.email = 'E-post on kohustuslik'
    } else if (!validateEmail(email.trim())) {
      errors.email = 'Palun sisestage kehtiv e-posti aadress.'
    }
    if (!consent) errors.consent = 'Nõusolek on kohustuslik'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBusy(true)
    setError(null)
    try {
      await requestJson('/api/leads', {
        method: 'POST',
        body: JSON.stringify({
          formName: 'portal-user-objects-sell-forest',
          pageSlug: '/user/objects',
          contactName: contactName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          cadastr: cadastr.trim(),
          consentAt: new Date().toISOString(),
          source: 'web',
          [HONEYPOT_FIELD]: '',
        }),
      })
      setDone(true)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Saatmine ebaõnnestus. Palun proovige hiljem uuesti.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Müüa metsa" size="md">
      {done ? (
        <div className="flex flex-col gap-sm">
          <p className="text-body text-ink">
            Aitäh! Päring on edastatud. Meie spetsialist võtab teiega esimesel
            võimalusel ühendust.
          </p>
          <Btn onClick={handleClose}>Sulge</Btn>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            void handleSubmit(event)
          }}
          className="flex flex-col gap-sm"
          noValidate
        >
          <p className="text-bodySm text-inkMuted">
            Jätke kontaktandmed ja meie spetsialist hindab teie metsa ning aitab
            selle müüki panna.
          </p>
          <FormInput
            label="Nimi"
            name="contactName"
            required
            value={contactName}
            disabled={busy}
            {...(fieldErrors.contactName ? { error: fieldErrors.contactName } : {})}
            onChange={(event) => {
              setContactName(event.target.value)
            }}
          />
          <FormInput
            label="Telefon"
            name="phone"
            type="tel"
            required
            value={phone}
            disabled={busy}
            {...(fieldErrors.phone ? { error: fieldErrors.phone } : {})}
            onChange={(event) => {
              setPhone(event.target.value)
            }}
          />
          <FormInput
            label="E-post"
            name="email"
            type="email"
            required
            value={email}
            disabled={busy}
            {...(fieldErrors.email ? { error: fieldErrors.email } : {})}
            onChange={(event) => {
              setEmail(event.target.value)
            }}
          />
          <FormInput
            label="Katastritunnus"
            name="cadastr"
            hint="Valikuline — metsaüksuse viitamiseks."
            value={cadastr}
            disabled={busy}
            onChange={(event) => {
              setCadastr(event.target.value)
            }}
          />
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <input
              type="text"
              name={HONEYPOT_FIELD}
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>
          <ConsentCheck
            name="consent"
            label="Nõustun isikuandmete töötlemisega"
            {...(fieldErrors.consent ? { error: fieldErrors.consent } : {})}
            onChange={setConsent}
          />
          {error !== null && (
            <p role="alert" className="text-bodySm text-danger">
              {error}
            </p>
          )}
          <div className="mt-2xs flex flex-col gap-xs sm:flex-row">
            <Btn variant="outline" type="button" onClick={handleClose} disabled={busy}>
              Katkesta
            </Btn>
            <Btn type="submit" isLoading={busy}>
              Saada päring
            </Btn>
          </div>
        </form>
      )}
    </Modal>
  )
}

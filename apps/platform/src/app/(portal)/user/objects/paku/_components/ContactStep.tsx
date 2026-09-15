'use client'

import { FormInput } from '@erametsad/ui'

import type { ContactData, StepErrors } from './types'

interface ContactStepProps {
  contact: ContactData
  errors: StepErrors
  onChange: (patch: Partial<ContactData>) => void
}

export function ContactStep({ contact, errors, onChange }: ContactStepProps) {
  return (
    <fieldset className="flex flex-col gap-md">
      <legend className="mb-2xs font-heading text-h3 font-semibold text-ink">
        Kontaktandmed
      </legend>
      <p className="text-bodySm text-inkMuted">
        Andmed on eeltäidetud sinu profiilist — kontrolli ja muuda vajadusel.
      </p>
      <FormInput
        label="Sinu nimi"
        name="contact-name"
        required
        autoComplete="name"
        value={contact.name}
        onChange={(event) => {
          onChange({ name: event.target.value })
        }}
        {...(errors['contact.name'] ? { error: errors['contact.name'] } : {})}
      />
      <FormInput
        label="Telefoninumber"
        name="contact-phone"
        type="tel"
        required
        autoComplete="tel"
        hint="Vorming +37251234567"
        value={contact.phone}
        onChange={(event) => {
          onChange({ phone: event.target.value })
        }}
        {...(errors['contact.phone'] ? { error: errors['contact.phone'] } : {})}
      />
      <FormInput
        label="E-mail"
        name="contact-email"
        type="email"
        required
        autoComplete="email"
        value={contact.email}
        onChange={(event) => {
          onChange({ email: event.target.value })
        }}
        {...(errors['contact.email'] ? { error: errors['contact.email'] } : {})}
      />
    </fieldset>
  )
}

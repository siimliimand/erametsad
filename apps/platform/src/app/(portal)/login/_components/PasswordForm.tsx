'use client'

import { Btn, FormInput } from '@erametsad/ui'
import Link from 'next/link'
import { useState, type SyntheticEvent } from 'react'

interface PasswordFormProps {
  next: string | null
  disabled: boolean
  onSubmit: (identifier: string, password: string) => Promise<string | null>
}

export function PasswordForm({ next, disabled, onSubmit }: PasswordFormProps) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const resetHref = next
    ? `/reset-password?next=${encodeURIComponent(next)}`
    : '/reset-password'

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || disabled) return
    setBusy(true)
    setError(null)
    const message = await onSubmit(identifier.trim(), password)
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
      className="flex flex-col gap-sm"
      noValidate
    >
      <h2 className="font-heading text-h4 text-ink">Või logi sisse parooliga</h2>

      <FormInput
        label="Isikukood või e-post"
        name="identifier"
        autoComplete="username"
        required
        disabled={disabled || busy}
        value={identifier}
        onChange={(event) => {
          setIdentifier(event.target.value)
        }}
      />

      <FormInput
        label="Parool"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        disabled={disabled || busy}
        value={password}
        onChange={(event) => {
          setPassword(event.target.value)
        }}
      />

      {error && (
        <p role="alert" className="font-body text-bodySm text-danger">
          {error}
        </p>
      )}

      <Btn type="submit" isLoading={busy} disabled={disabled}>
        Logi sisse
      </Btn>

      <Link
        href={resetHref}
        className="font-body text-bodySm text-primary underline-offset-2 hover:underline"
      >
        Unustasid parooli?
      </Link>
    </form>
  )
}

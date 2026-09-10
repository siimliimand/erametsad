'use client'

import { Btn } from '@erametsad/ui'
import Link from 'next/link'
import { useState, type SyntheticEvent } from 'react'

import { AuthField } from './AuthField'

interface PasswordFormProps {
  next: string | null
  disabled: boolean
  onSubmit: (identifier: string, password: string) => Promise<string | null>
}

// Demo 05 fallback form: isikukood + password, full-width outline submit and
// the centered "Unustasid salasõna?" link.
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
      <AuthField
        label="Isikukood"
        name="identifier"
        inputMode="numeric"
        maxLength={11}
        autoComplete="username"
        placeholder="38001010000"
        required
        disabled={disabled || busy}
        value={identifier}
        onChange={(event) => {
          setIdentifier(event.target.value)
        }}
      />

      <AuthField
        label="Parool"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
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

      <div className="mt-1 [&_button]:w-full">
        <Btn type="submit" variant="outline" isLoading={busy} disabled={disabled}>
          Logi sisse parooliga
        </Btn>
      </div>

      <p className="text-center font-body text-bodySm">
        <Link href={resetHref} className="text-primary underline-offset-2 hover:underline">
          Unustasid salasõna?
        </Link>
      </p>
    </form>
  )
}

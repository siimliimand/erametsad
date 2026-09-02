'use client'

import { Btn, FormInput } from '@erametsad/ui'
import Link from 'next/link'
import { useState, type ReactNode, type SyntheticEvent } from 'react'

import {
  PasswordStrengthMeter,
  evaluatePassword,
} from './PasswordStrengthMeter'

const NETWORK_ERROR = 'Võrguühendus ei ole saadaval. Proovi uuesti.'
const DEFAULT_FALLBACK_ERROR = 'Parooli salvestamine ei õnnestunud. Proovi uuesti.'

async function readBody(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object') {
      return body as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

function bodyText(
  body: Record<string, unknown> | null,
  key: 'message' | 'error',
): string | null {
  const value = body?.[key]
  return typeof value === 'string' && value ? value : null
}

interface PasswordFormProps {
  endpoint: string
  /**
   * Reset-flow token: the body becomes `{ token, password }`. Omit for the
   * change-password endpoint, which receives oldPassword/newPassword.
   */
  resetToken?: string
  withCurrentPassword?: boolean
  currentPasswordLabel?: string
  newPasswordLabel?: string
  /** Enables the "≠ isikukood" rule; omit when the code is not known client-side. */
  isikukood?: string | null | undefined
  submitLabel?: string
  fallbackError?: string
  /** Rendered under the error line (e.g. a link to request a new reset token). */
  errorFooter?: ReactNode
  /** When either success prop is given, the form swaps to a success panel on 200. */
  successTitle?: ReactNode
  successNote?: ReactNode
  /** Called with the server's success message before/instead of the built-in panel. */
  onSuccess?: (message: string | null) => void
}

export function PasswordForm({
  endpoint,
  resetToken,
  withCurrentPassword = false,
  currentPasswordLabel = 'Praegune parool',
  newPasswordLabel = 'Uus parool',
  isikukood,
  submitLabel = 'Salvesta',
  fallbackError = DEFAULT_FALLBACK_ERROR,
  errorFooter,
  successTitle,
  successNote,
  onSuccess,
}: PasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const evaluation = evaluatePassword(newPassword, isikukood)
  const canSubmit = evaluation.valid && !busy

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setError(null)
    setBusy(true)
    // Built client-side so no function crosses the server/client boundary.
    const body =
      resetToken !== undefined
        ? { token: resetToken, password: newPassword }
        : withCurrentPassword
          ? { oldPassword: currentPassword, newPassword }
          : { newPassword }
    let message: string | null = null
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await readBody(response)
      if (!response.ok) {
        setError(bodyText(payload, 'error') ?? fallbackError)
        return
      }
      message = bodyText(payload, 'message')
    } catch {
      setError(NETWORK_ERROR)
      return
    } finally {
      setBusy(false)
    }
    onSuccess?.(message)
    if (successTitle !== undefined || successNote !== undefined) {
      setSuccessMessage(message)
      setDone(true)
    }
  }

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-sm">
        <h2 className="font-heading text-h4 text-ink">
          {successTitle ?? 'Valmis'}
        </h2>
        {successMessage && (
          <p className="font-body text-body text-inkMuted">{successMessage}</p>
        )}
        {successNote}
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
      className="flex flex-col gap-sm"
      noValidate
    >
      {withCurrentPassword && (
        <FormInput
          label={currentPasswordLabel}
          name="current-password"
          type="password"
          autoComplete="current-password"
          required
          disabled={busy}
          value={currentPassword}
          onChange={(event) => {
            setCurrentPassword(event.target.value)
          }}
        />
      )}

      <FormInput
        label={newPasswordLabel}
        name="new-password"
        type="password"
        autoComplete="new-password"
        required
        disabled={busy}
        value={newPassword}
        onChange={(event) => {
          setNewPassword(event.target.value)
        }}
      />

      <PasswordStrengthMeter password={newPassword} isikukood={isikukood} />

      {error && (
        <p role="alert" className="font-body text-bodySm text-danger">
          {error}
        </p>
      )}
      {error && errorFooter}

      <Btn type="submit" isLoading={busy} disabled={!canSubmit}>
        {submitLabel}
      </Btn>
    </form>
  )
}

interface PasswordResetRequestFormProps {
  /** Validated same-origin ?next= carried back into the login link. */
  next?: string | null
}

export function PasswordResetRequestForm({ next }: PasswordResetRequestFormProps) {
  const [identifier, setIdentifier] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loginHref = next
    ? `/login?next=${encodeURIComponent(next)}`
    : '/login'

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const response = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      })
      const payload = await readBody(response)
      if (!response.ok) {
        setError(
          bodyText(payload, 'error') ??
            'Parooli taastamine ei õnnestunud. Proovi uuesti.',
        )
        return
      }
      setSuccessMessage(
        bodyText(payload, 'message') ??
          'Kui konto on olemas, saadeti parooli lähtestamise link e-posti aadressile.',
      )
    } catch {
      setError(NETWORK_ERROR)
    } finally {
      setBusy(false)
    }
  }

  if (successMessage) {
    return (
      <div role="status" className="flex flex-col gap-sm">
        <h2 className="font-heading text-h4 text-ink">Kontrolli oma e-posti</h2>
        <p className="font-body text-body text-inkMuted">{successMessage}</p>
        <Link
          href={loginHref}
          className="font-body text-bodySm text-primary underline-offset-2 hover:underline"
        >
          Tagasi sisselogimisele
        </Link>
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
      className="flex flex-col gap-sm"
      noValidate
    >
      <FormInput
        label="Isikukood või e-post"
        name="identifier"
        autoComplete="username"
        required
        disabled={busy}
        value={identifier}
        onChange={(event) => {
          setIdentifier(event.target.value)
        }}
      />

      <p className="font-body text-bodySm text-inkMuted">
        Saadame sulle e-posti aadressile lingi, millega saad parooli uueks
        seada. Link kehtib 2 tundi.
      </p>

      {error && (
        <p role="alert" className="font-body text-bodySm text-danger">
          {error}
        </p>
      )}

      <Btn type="submit" isLoading={busy}>
        Saada taastamislink
      </Btn>
    </form>
  )
}

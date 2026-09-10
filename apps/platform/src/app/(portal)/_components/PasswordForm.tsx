'use client'

import { Btn, FormInput } from '@erametsad/ui'
import { CircleCheck, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react'

import {
  PasswordStrengthMeter,
  evaluatePassword,
} from './PasswordStrengthMeter'

import { apiFetch } from '@/lib/api/client'

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

function capsLockState(event: KeyboardEvent<HTMLInputElement>): boolean {
  return event.getModifierState('CapsLock')
}

interface PasswordInputProps {
  label: string
  name: string
  autoComplete: string
  value: string
  disabled?: boolean
  error?: string | null
  onChange: (value: string) => void
  onBlur?: () => void
}

// Demo auth field (.pw-wrap): visible label, trailing show/hide toggle and a
// live Caps Lock warning.
function PasswordInput({
  label,
  name,
  autoComplete,
  value,
  disabled = false,
  error,
  onChange,
  onBlur,
}: PasswordInputProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  const describedBy =
    [error ? `${inputId}-error` : null, capsLock ? `${inputId}-caps` : null]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="font-body text-bodySm font-semibold text-ink"
      >
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          disabled={disabled}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
          }}
          onKeyDown={(event) => {
            setCapsLock(capsLockState(event))
          }}
          onKeyUp={(event) => {
            setCapsLock(capsLockState(event))
          }}
          onBlur={() => {
            setCapsLock(false)
            onBlur?.()
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-12 w-full rounded-button border bg-bgPage px-3.5 pr-12 font-body text-body text-ink outline-none transition-colors duration-hover ease-hover motion-reduce:transition-none ${
            error
              ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/20'
              : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20'
          }`}
        />
        <button
          type="button"
          disabled={disabled}
          aria-pressed={visible}
          aria-label={visible ? 'Peida parool' : 'Näita parooli'}
          onClick={() => {
            setVisible((previous) => !previous)
            inputRef.current?.focus()
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-inkMuted transition-colors duration-hover ease-hover hover:text-ink motion-reduce:transition-none"
        >
          {visible ? (
            <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
          ) : (
            <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <p
          id={`${inputId}-error`}
          className="font-body text-bodySm font-medium text-danger"
        >
          {error}
        </p>
      )}
      {capsLock && (
        <p
          id={`${inputId}-caps`}
          className="font-body text-bodySm font-semibold text-ctaHover"
        >
          Caps Lock on sees.
        </p>
      )}
    </div>
  )
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
  /** Renders the "Uus parool uuesti" field and gates submit on an exact match. */
  withRepeatPassword?: boolean
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
  withRepeatPassword = false,
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
  const [repeatPassword, setRepeatPassword] = useState('')
  const [currentTouched, setCurrentTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const evaluation = evaluatePassword(newPassword, isikukood)
  const currentMissing =
    withCurrentPassword && currentTouched && currentPassword.length === 0
  const repeatMismatch =
    withRepeatPassword &&
    repeatPassword.length > 0 &&
    repeatPassword !== newPassword
  const canSubmit =
    evaluation.valid &&
    (!withCurrentPassword || currentPassword.length > 0) &&
    (!withRepeatPassword ||
      (repeatPassword.length > 0 && repeatPassword === newPassword)) &&
    !busy

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
      <div
        role="status"
        className="flex flex-col items-center gap-1.5 text-center"
      >
        <CircleCheck className="h-11 w-11 text-accent" aria-hidden="true" />
        <h2 className="font-heading text-h3 text-ink">
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
      className="flex flex-col gap-4"
      noValidate
    >
      {withCurrentPassword && (
        <PasswordInput
          label={currentPasswordLabel}
          name="current-password"
          autoComplete="current-password"
          value={currentPassword}
          disabled={busy}
          error={currentMissing ? 'Sisesta praegune parool.' : null}
          onChange={setCurrentPassword}
          onBlur={() => {
            setCurrentTouched(true)
          }}
        />
      )}

      <PasswordInput
        label={newPasswordLabel}
        name="new-password"
        autoComplete="new-password"
        value={newPassword}
        disabled={busy}
        onChange={setNewPassword}
      />

      <PasswordStrengthMeter password={newPassword} isikukood={isikukood} />

      {withRepeatPassword && (
        <PasswordInput
          label="Uus parool uuesti"
          name="repeat-password"
          autoComplete="new-password"
          value={repeatPassword}
          disabled={busy}
          error={repeatMismatch ? 'Paroolid ei kattu.' : null}
          onChange={setRepeatPassword}
        />
      )}

      {error && (
        <p role="alert" className="font-body text-bodySm text-danger">
          {error}
        </p>
      )}
      {error && errorFooter}

      <div className="mt-1 [&_button]:w-full">
        <Btn type="submit" isLoading={busy} disabled={!canSubmit}>
          {submitLabel}
        </Btn>
      </div>
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
      const response = await apiFetch('/api/v1/auth/forgot-password', {
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

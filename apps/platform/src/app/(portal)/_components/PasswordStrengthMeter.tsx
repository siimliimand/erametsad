'use client'

export const PASSWORD_MIN_LENGTH = 10

// A valid password that barely clears the rules stays "Kesine"; extra length
// pushes it to "Tugev".
const STRONG_MIN_LENGTH = 12

export interface PasswordRules {
  minLength: boolean
  hasUppercase: boolean
  hasNumber: boolean
  hasSymbol: boolean
  notIsikukood: boolean
}

export type PasswordTier = 'weak' | 'medium' | 'strong'

export interface PasswordEvaluation {
  valid: boolean
  tier: PasswordTier
  rules: PasswordRules
}

export function evaluatePassword(
  password: string,
  isikukood?: string | null,
): PasswordEvaluation {
  const expected = isikukood?.trim()
  const rules: PasswordRules = {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    hasUppercase: /\p{Lu}/u.test(password),
    hasNumber: /\p{Nd}/u.test(password),
    hasSymbol: /[^\p{L}\p{Nd}\s]/u.test(password),
    notIsikukood: !expected || password.trim() !== expected,
  }
  const valid = Object.values(rules).every(Boolean)
  const tier: PasswordTier = !valid
    ? 'weak'
    : password.length >= STRONG_MIN_LENGTH
      ? 'strong'
      : 'medium'
  return { valid, tier, rules }
}

const RULE_CHECKS: ReadonlyArray<{ key: keyof PasswordRules; label: string }> = [
  { key: 'minLength', label: `Vähemalt ${PASSWORD_MIN_LENGTH} tähemärki` },
  { key: 'hasUppercase', label: 'Vähemalt üks suurtäht' },
  { key: 'hasNumber', label: 'Vähemalt üks number' },
  { key: 'hasSymbol', label: 'Vähemalt üks sümbol' },
  { key: 'notIsikukood', label: 'Ei tohi olla sinu isikukood' },
]

const TIER_META: Record<
  PasswordTier,
  { label: string; segments: number; bar: string; text: string }
> = {
  weak: {
    label: 'Nõrk',
    segments: 1,
    bar: 'bg-statusCritical',
    text: 'text-statusCritical',
  },
  medium: { label: 'Kesine', segments: 2, bar: 'bg-cta', text: 'text-ctaHover' },
  strong: {
    label: 'Tugev',
    segments: 3,
    bar: 'bg-statusActive',
    text: 'text-statusActive',
  },
}

interface PasswordStrengthMeterProps {
  password: string
  isikukood?: string | null | undefined
  className?: string
}

export function PasswordStrengthMeter({
  password,
  isikukood,
  className,
}: PasswordStrengthMeterProps) {
  const { tier, rules } = evaluatePassword(password, isikukood)
  const meta = TIER_META[tier]
  const active = password.length > 0

  return (
    <div className={className ?? 'flex flex-col gap-xs'}>
      <div className="flex items-center gap-sm">
        <div className="flex flex-1 gap-2xs" aria-hidden="true">
          {[0, 1, 2].map((segment) => (
            <span
              key={segment}
              className={`h-1 flex-1 rounded-pill ${
                active && segment < meta.segments ? meta.bar : 'bg-border'
              }`}
            />
          ))}
        </div>
        <span
          className={`font-label ${active ? meta.text : 'text-inkMuted'}`}
          aria-live="polite"
        >
          {active ? meta.label : 'Parooli tugevus'}
        </span>
      </div>

      <ul className="flex flex-col gap-2xs">
        {RULE_CHECKS.map(({ key, label }) => {
          const ok = rules[key]
          return (
            <li
              key={key}
              className={`flex items-center gap-2xs font-body text-bodySm ${
                ok ? 'text-statusActive' : 'text-inkMuted'
              }`}
            >
              <span aria-hidden="true">{ok ? '✓' : '✗'}</span>
              <span className="sr-only">{ok ? 'Täidetud' : 'Täitmata'}: </span>
              {label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

'use client'

import { Check, Circle } from 'lucide-react'

export const PASSWORD_MIN_LENGTH = 10

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
  // Demo meter: one segment per satisfied rule and the label follows the
  // count (0-2 Nõrk, 3 Keskmine, 4-5 Tugev). The submit gate uses `valid`,
  // which is stricter than the meter label.
  const score = Object.values(rules).filter(Boolean).length
  const tier: PasswordTier =
    score <= 2 ? 'weak' : score === 3 ? 'medium' : 'strong'
  return { valid, tier, rules }
}

const RULE_CHECKS: readonly { key: keyof PasswordRules; label: string }[] = [
  { key: 'minLength', label: `Vähemalt ${String(PASSWORD_MIN_LENGTH)} tähemärki` },
  { key: 'hasUppercase', label: 'Üks suur täht' },
  { key: 'hasNumber', label: 'Üks number' },
  { key: 'hasSymbol', label: 'Üks sümbol' },
  { key: 'notIsikukood', label: 'Ei tohi kattuda isikukoodiga' },
]

const SEGMENT_COUNT = 5

const TIER_META: Record<PasswordTier, { label: string; bar: string; text: string }> = {
  weak: { label: 'Nõrk', bar: 'bg-danger', text: 'text-danger' },
  medium: { label: 'Keskmine', bar: 'bg-cta', text: 'text-ctaHover' },
  strong: { label: 'Tugev', bar: 'bg-accent', text: 'text-primaryHover' },
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
  const score = Object.values(rules).filter(Boolean).length
  const active = password.length > 0

  return (
    <div className={className ?? 'flex flex-col gap-2xs'}>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: SEGMENT_COUNT }, (_, segment) => (
          <span
            key={segment}
            className={`h-1.5 flex-1 rounded-pill transition-colors duration-hover ease-hover motion-reduce:transition-none ${
              active && segment < score ? meta.bar : 'bg-border'
            }`}
          />
        ))}
      </div>
      <p
        className={`font-label text-bodySm font-semibold ${
          active ? meta.text : 'text-inkMuted'
        }`}
        aria-live="polite"
      >
        {active ? meta.label : 'Parooli tugevus'}
      </p>

      <ul className="flex flex-col gap-1">
        {RULE_CHECKS.map(({ key, label }) => {
          const ok = rules[key]
          return (
            <li
              key={key}
              className={`flex items-center gap-2 font-body text-bodySm ${
                ok ? 'text-ink' : 'text-inkMuted'
              }`}
            >
              {ok ? (
                <Check
                  className="h-3.5 w-3.5 shrink-0 text-accent"
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className="h-3.5 w-3.5 shrink-0 text-border"
                  aria-hidden="true"
                />
              )}
              <span className="sr-only">{ok ? 'Täidetud' : 'Täitmata'}: </span>
              {label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

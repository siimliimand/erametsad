// Mirrors the client rules in (portal)/_components/PasswordStrengthMeter.tsx
// (evaluatePassword); keep the two in sync until this module is shared with
// the client. Pure on purpose: no node imports, so the client can import it.
export const PASSWORD_MIN_LENGTH = 10

export type PasswordRuleCode =
  | 'minLength'
  | 'hasUppercase'
  | 'hasNumber'
  | 'hasSymbol'
  | 'notIsikukood'

export interface PasswordPolicyViolation {
  code: PasswordRuleCode
  message: string
}

const RULE_MESSAGES: Record<PasswordRuleCode, string> = {
  minLength: `Parool peab olema vähemalt ${String(PASSWORD_MIN_LENGTH)} tähemärki`,
  hasUppercase: 'Paroolis peab olema vähemalt üks suurtäht',
  hasNumber: 'Paroolis peab olema vähemalt üks number',
  hasSymbol: 'Paroolis peab olema vähemalt üks sümbol',
  notIsikukood: 'Parool ei tohi olla sinu isikukood',
}

const RULE_ORDER: readonly PasswordRuleCode[] = [
  'minLength',
  'hasUppercase',
  'hasNumber',
  'hasSymbol',
  'notIsikukood',
]

/**
 * Server-side twin of the client's evaluatePassword: every failed rule in the
 * client's display order. The isikukood rule only applies when the code is
 * known; a trimmed comparison so whitespace cannot smuggle the code through.
 */
export function checkPasswordPolicy(
  password: string,
  isikukood?: string | null,
): PasswordPolicyViolation[] {
  const failed = new Set<PasswordRuleCode>()
  if (password.length < PASSWORD_MIN_LENGTH) failed.add('minLength')
  if (!/\p{Lu}/u.test(password)) failed.add('hasUppercase')
  if (!/\p{Nd}/u.test(password)) failed.add('hasNumber')
  if (!/[^\p{L}\p{Nd}\s]/u.test(password)) failed.add('hasSymbol')
  const expected = isikukood?.trim()
  if (expected && password.trim() === expected) failed.add('notIsikukood')
  return RULE_ORDER.filter((code) => failed.has(code)).map((code) => ({
    code,
    message: RULE_MESSAGES[code],
  }))
}

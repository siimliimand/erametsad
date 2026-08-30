'use client'

// Identity snapshot form for the sealed-bid panel. The fields mirror the
// identity snapshot the sealed admission stores next to the encrypted
// amount: the bidder's name plus isikukood (private) or registrikood
// (company). Validation runs client-side so an invalid code blocks
// submission before any API call; the API stays the final arbiter.

export type SealedProfileType = 'private' | 'company'

export interface SealedIdentityValues {
  name: string
  code: string
}

export interface SealedIdentityErrors {
  name: string | null
  code: string | null
}

// Estonian personal code: 11 digits, first digit 1-8 (sex/century), and a
// check digit computed with the standard 1..9,1 then 3..9,1,2,3 weights.
const ISIKUKOOD_WEIGHTS_1: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1]
const ISIKUKOOD_WEIGHTS_2: readonly number[] = [3, 4, 5, 6, 7, 8, 9, 1, 2, 3]

function isikukoodCheckDigit(code: string): number {
  const digits = Array.from(code, (char) => Number(char))
  const sum = (weights: readonly number[]): number =>
    weights.reduce((total, weight, index) => total + weight * (digits[index] ?? 0), 0)
  let remainder = sum(ISIKUKOOD_WEIGHTS_1) % 11
  if (remainder === 10) {
    remainder = sum(ISIKUKOOD_WEIGHTS_2) % 11
    if (remainder === 10) remainder = 0
  }
  return remainder
}

export function validateIsikukood(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false
  const centuryDigit = Number(value.charAt(0))
  if (centuryDigit < 1 || centuryDigit > 8) return false
  return isikukoodCheckDigit(value) === Number(value.charAt(10))
}

export function validateRegistrikood(value: string): boolean {
  return /^\d{8}$/.test(value)
}

export function validateIdentityCode(
  profileType: SealedProfileType,
  value: string,
): boolean {
  return profileType === 'company'
    ? validateRegistrikood(value)
    : validateIsikukood(value)
}

export function identityCodeLabel(profileType: SealedProfileType): string {
  return profileType === 'company' ? 'Registrikood' : 'Isikukood'
}

export function identityCodeErrorMessage(profileType: SealedProfileType): string {
  return profileType === 'company'
    ? 'Registrikood peab koosnema 8 numbrist.'
    : 'Isikukood ei ole korrektne. Kontrolli 11-numbrilist koodi.'
}

export function identityNameLabel(profileType: SealedProfileType): string {
  return profileType === 'company' ? 'Ettevõtte nimi' : 'Nimi'
}

export function identityNameErrorMessage(profileType: SealedProfileType): string {
  return profileType === 'company'
    ? 'Sisesta ettevõtte nimi.'
    : 'Sisesta oma nimi.'
}

/** JSON payload stored as the bid's identity snapshot string. */
export function sealedIdentitySnapshot(
  profileType: SealedProfileType,
  values: SealedIdentityValues,
): string {
  return JSON.stringify(
    profileType === 'company'
      ? { name: values.name, registrikood: values.code }
      : { name: values.name, isikukood: values.code },
  )
}

export interface SealedIdentityFormProps {
  profileType: SealedProfileType
  values: SealedIdentityValues
  onChange: (values: SealedIdentityValues) => void
  errors: SealedIdentityErrors
  disabled?: boolean
}

export function SealedIdentityForm({
  profileType,
  values,
  onChange,
  errors,
  disabled = false,
}: SealedIdentityFormProps) {
  const inputClasses =
    'h-12 w-full rounded-input border border-border bg-bgPage px-4 text-body text-ink outline-none transition-colors aria-[invalid=true]:border-danger focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-bgMist disabled:text-inkMuted'

  return (
    <div className="flex flex-col gap-xs">
      <div>
        <label htmlFor="sealed-identity-name" className="text-label font-semibold text-ink">
          {identityNameLabel(profileType)}
        </label>
        <input
          id="sealed-identity-name"
          name="identityName"
          type="text"
          autoComplete="off"
          value={values.name}
          disabled={disabled}
          onChange={(event) => {
            onChange({ ...values, name: event.target.value })
          }}
          aria-invalid={errors.name !== null}
          className={inputClasses}
        />
        {errors.name !== null && (
          <p role="alert" className="mt-2xs text-bodySm text-danger">
            {errors.name}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="sealed-identity-code" className="text-label font-semibold text-ink">
          {identityCodeLabel(profileType)}
        </label>
        <input
          id="sealed-identity-code"
          name="identityCode"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={values.code}
          disabled={disabled}
          onChange={(event) => {
            onChange({ ...values, code: event.target.value })
          }}
          aria-invalid={errors.code !== null}
          className={inputClasses}
        />
        {errors.code !== null && (
          <p role="alert" className="mt-2xs text-bodySm text-danger">
            {errors.code}
          </p>
        )}
      </div>
    </div>
  )
}

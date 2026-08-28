import { z } from 'zod'

const ALLOWED_FIRST_DIGITS = /^[1-8]$/

const WEIGHTS_1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1]
const WEIGHTS_2 = [3, 4, 5, 6, 7, 8, 9, 1, 2, 3]

function isValidIsikukood(code: string): boolean {
  const first = code[0]
  if (!first || !ALLOWED_FIRST_DIGITS.test(first)) return false
  const digits = code.split('').map(Number)
  const sum1 = digits.slice(0, 10).reduce((acc, d, i) => acc + d * WEIGHTS_1[i]!, 0)
  let checksum = sum1 % 11
  if (checksum === 10) {
    const sum2 = digits.slice(0, 10).reduce((acc, d, i) => acc + d * WEIGHTS_2[i]!, 0)
    checksum = sum2 % 11
    if (checksum === 10) return false
  }
  const last = digits[10]
  return last !== undefined && checksum === last
}

export const EEPhone = z
  .string()
  .regex(/^\+372\d{7,8}$/, 'Must be a valid Estonian phone number (+372 followed by 7-8 digits)')

export const EEIsikukood = z
  .string()
  .length(11, 'Estonian personal ID code must be exactly 11 digits')
  .regex(/^\d{11}$/, 'Estonian personal ID code must be 11 digits')
  .refine(isValidIsikukood, 'Invalid Estonian personal ID code checksum')

export const EERegistrikood = z
  .string()
  .regex(/^\d{8}$/, 'Estonian business registry code must be exactly 8 digits')

export const EECadastral = z
  .string()
  .regex(
    /^\d{5}:\d{3}:\d{4}$/,
    'Estonian cadastral code must follow the format NNNNN:NNN:NNNN',
  )

export const EEEmail = z
  .string()
  .email('Must be a valid email address')

export const validators = {
  EEPhone,
  EEIsikukood,
  EERegistrikood,
  EECadastral,
  EEEmail,
}
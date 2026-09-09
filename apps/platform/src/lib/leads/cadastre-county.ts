import { splitCadastreInput } from '@erametsad/types'

/**
 * Katastritunnuse legacy county codes: digits 1-3 of the cadastral
 * identifier encode the former county numbering used by Maa-amet
 * (e.g. 78402:003:0210 -> 784 -> Harju). Derived leads store the
 * two-letter county code's row id, so only the mapping lives here.
 */
const LEGACY_CODE_TO_COUNTY_CODE: Readonly<Record<string, string>> = {
  '784': 'HH', // Harju
  '174': 'HI', // Hiiu
  '194': 'IV', // Ida-Viru
  '324': 'JG', // Jõgeva
  '364': 'JR', // Järva
  '444': 'LN', // Lääne
  '474': 'LV', // Lääne-Viru
  '534': 'PL', // Põlva
  '594': 'PR', // Pärnu
  '654': 'RA', // Rapla
  '674': 'SR', // Saare
  '789': 'TA', // Tartu
  '814': 'VG', // Valga
  '824': 'VR', // Viljandi
  '874': 'VO', // Võru
}

/**
 * County code derived from the first cadastre of the input, or null when
 * the field is empty or its first entry does not carry a known county
 * prefix. Unmappable entries never throw so ingestion keeps working for
 * legacy or malformed cadastres.
 */
export function deriveCountyCodeFromCadastre(
  cadastr: string | null | undefined,
): string | null {
  const first = splitCadastreInput(cadastr ?? '')[0]
  if (!first) return null
  const legacyCode = first.slice(0, 3)
  return LEGACY_CODE_TO_COUNTY_CODE[legacyCode] ?? null
}

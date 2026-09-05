import { z } from 'zod'

export const EECountyCode = z.enum(
  ['HH', 'HI', 'IV', 'JG', 'JR', 'LN', 'LV', 'PL', 'PR', 'RA', 'SR', 'TA', 'VG', 'VR', 'VO'],
  {
    errorMap: () => ({ message: 'Valige kehtiv maakond' }),
  },
)

export type EECountyCode = z.infer<typeof EECountyCode>

export interface EECounty {
  readonly name: string
  readonly code: EECountyCode
}

export const EE_COUNTIES: readonly EECounty[] = [
  { name: 'Harju', code: 'HH' },
  { name: 'Hiiu', code: 'HI' },
  { name: 'Ida-Viru', code: 'IV' },
  { name: 'Jõgeva', code: 'JG' },
  { name: 'Järva', code: 'JR' },
  { name: 'Lääne', code: 'LN' },
  { name: 'Lääne-Viru', code: 'LV' },
  { name: 'Põlva', code: 'PL' },
  { name: 'Pärnu', code: 'PR' },
  { name: 'Rapla', code: 'RA' },
  { name: 'Saare', code: 'SR' },
  { name: 'Tartu', code: 'TA' },
  { name: 'Valga', code: 'VG' },
  { name: 'Viljandi', code: 'VR' },
  { name: 'Võru', code: 'VO' },
]

import { z } from 'zod'

import { EECadastralList } from './cadastres'
import { EECountyCode } from './counties'
import { EE_PHONE_PATTERN } from './validators'

export const serviceRequestContactSchema = z.object({
  name: z
    .string({
      required_error: 'Nimi on kohustuslik',
      invalid_type_error: 'Nimi peab olema tekst',
    })
    .trim()
    .min(1, 'Nimi on kohustuslik'),
  phone: z
    .string({
      required_error: 'Telefoninumber on kohustuslik',
      invalid_type_error: 'Telefoninumber peab olema tekst',
    })
    .trim()
    .regex(EE_PHONE_PATTERN, 'Sisestage kehtiv Eesti telefoninumber (nt +37251234567)'),
  email: z
    .string({
      required_error: 'E-posti aadress on kohustuslik',
      invalid_type_error: 'E-posti aadress peab olema tekst',
    })
    .trim()
    .email('Sisestage kehtiv e-posti aadress'),
})

export type ServiceRequestContact = z.infer<typeof serviceRequestContactSchema>

export const ServiceRequestType = z.enum(['kava', 'hooldusraie', 'istutamine'])
export type ServiceRequestType = z.infer<typeof ServiceRequestType>

export const HooldusraieService = z.enum(['hooldamine', 'valgusraie'], {
  errorMap: () => ({ message: 'Tundmatu hooldusraie teenus' }),
})
export type HooldusraieService = z.infer<typeof HooldusraieService>

export const HOOLDUSRAIE_SERVICE_OPTIONS: readonly {
  value: HooldusraieService
  label: string
}[] = [
  { value: 'hooldamine', label: 'Hooldamine' },
  { value: 'valgusraie', label: 'Valgusraie' },
]

export const IstutamineService = z.enum(
  ['maapinna_ettevalmistus', 'istikud', 'istutamine'],
  {
    errorMap: () => ({ message: 'Tundmatu istutamise teenus' }),
  },
)
export type IstutamineService = z.infer<typeof IstutamineService>

export const ISTUTAMINE_SERVICE_OPTIONS: readonly {
  value: IstutamineService
  label: string
}[] = [
  { value: 'maapinna_ettevalmistus', label: 'Maapinna ettevalmistus' },
  { value: 'istikud', label: 'Istikud' },
  { value: 'istutamine', label: 'Istutamine' },
]

const commentSchema = z
  .string({ invalid_type_error: 'Kommentaar peab olema tekst' })
  .trim()
  .optional()

export const kavaRequestSchema = z.object({
  type: z.literal('kava'),
  contact: serviceRequestContactSchema,
  cadastres: EECadastralList,
  paper_copy: z
    .boolean({ invalid_type_error: 'Väärtus peab olema tõene või väär' })
    .optional(),
  comment: commentSchema,
})

export type KavaRequest = z.infer<typeof kavaRequestSchema>

export const hooldusraieRequestSchema = z.object({
  type: z.literal('hooldusraie'),
  contact: serviceRequestContactSchema,
  county: EECountyCode,
  cadastres: EECadastralList,
  provisions: z
    .string({
      required_error: 'Sisestage ülesanded ja tingimused',
      invalid_type_error: 'Ülesanded ja tingimused peavad olema tekst',
    })
    .trim()
    .min(1, 'Sisestage ülesanded ja tingimused'),
  services: z
    .array(HooldusraieService, {
      required_error: 'Valige vähemalt üks teenus',
      invalid_type_error: 'Teenused peavad olema loend',
    })
    .min(1, 'Valige vähemalt üks teenus'),
  comment: commentSchema,
})

export type HooldusraieRequest = z.infer<typeof hooldusraieRequestSchema>

export const istutamineRequestSchema = z.object({
  type: z.literal('istutamine'),
  contact: serviceRequestContactSchema,
  county: EECountyCode,
  cadastres: EECadastralList,
  provisions: z
    .string({
      required_error: 'Sisestage ülesanded ja tingimused',
      invalid_type_error: 'Ülesanded ja tingimused peavad olema tekst',
    })
    .trim()
    .min(1, 'Sisestage ülesanded ja tingimused'),
  services: z
    .array(IstutamineService, {
      required_error: 'Valige vähemalt üks teenus',
      invalid_type_error: 'Teenused peavad olema loend',
    })
    .min(1, 'Valige vähemalt üks teenus'),
  comment: commentSchema,
})

export type IstutamineRequest = z.infer<typeof istutamineRequestSchema>

export const serviceRequestPayloadSchema = z.discriminatedUnion('type', [
  kavaRequestSchema,
  hooldusraieRequestSchema,
  istutamineRequestSchema,
])

export type ServiceRequestPayload = z.infer<typeof serviceRequestPayloadSchema>

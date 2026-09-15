import { EECountyCode, serviceRequestContactSchema } from '@erametsad/types'
import { z } from 'zod'

import {
  CADASTRE_PATTERN,
  loggingTypeCodes,
  speciesCodes,
} from '@/app/(admin)/admin/auctions/_lib/auction-schema'
import { deriveCountyCodeFromCadastre } from '@/lib/leads/cadastre-county'

/**
 * Portal-safe sale submission schema (design D5). It carries only what a
 * logged-in user may offer about their own object: location, object data,
 * files, description, and contact. Pricing, auction mechanics, schedule,
 * and specialist fields stay admin-only, and `.strict()` rejects any
 * payload that smuggles them in, so the wizard client and the API route
 * enforce the exact same shape.
 *
 * The cadastre pattern and the species/logging code lists come from the
 * admin wizard schema so the two forms cannot drift. That import chain
 * holds no server-only modules, so the portal client can bundle it.
 */

/** The two sale branches the portal accepts; every other object type stays admin-only. */
export const saleObjectTypes = ['raieoigus', 'kinnistu'] as const

export type SaleObjectType = (typeof saleObjectTypes)[number]

export const saleSubmissionSchema = z
  .object({
    branch: z.literal('sale', {
      errorMap: () => ({ message: 'Tundmatu esituse haru.' }),
    }),
    objectType: z.enum(saleObjectTypes, {
      errorMap: () => ({ message: 'Vali sobiv objekti tüüp.' }),
    }),
    cadastres: z
      .array(
        z.string().regex(CADASTRE_PATTERN, 'Katastritunnuse vorming peab olema NNNNN:NNN:NNNN.'),
      )
      .min(1, 'Lisa vähemalt üks katastritunnus.'),
    /** The wizard auto-selects this from the derived code and the user may edit it (spec). */
    county: EECountyCode.optional(),
    address: z.string().trim().max(500, 'Aadress kuni 500 tähemärki.').optional(),
    areaHa: z
      .number({
        required_error: 'Sisesta pindala hektarites.',
        invalid_type_error: 'Sisesta pindala numbrina.',
      })
      .positive('Pindala peab olema positiivne.')
      .max(10000, 'Pindala kuni 10 000 ha.'),
    species: z
      .array(z.enum(speciesCodes, { errorMap: () => ({ message: 'Tundmatu puuliik.' }) }))
      .min(1, 'Vali vähemalt üks puuliik.'),
    loggingTypes: z
      .array(z.enum(loggingTypeCodes, { errorMap: () => ({ message: 'Tundmatu raieliik.' }) }))
      .min(1, 'Vali vähemalt üks raieliik.'),
    volumeM3: z
      .number({ invalid_type_error: 'Sisesta raiemahu numbrina.' })
      .positive('Raiemahu peab olema positiivne.')
      .optional(),
    /**
     * R2 object keys returned by the upload endpoint. Optional so a
     * submission never blocks on uploads; the 10-key cap mirrors the
     * upload endpoint's server-side count rule.
     */
    files: z
      .array(z.string().trim().min(1, 'Faili võti ei tohi olla tühi.'))
      .max(10, 'Lisa kuni 10 faili.')
      .optional(),
    description: z
      .string({
        required_error: 'Sisesta kirjeldus.',
        invalid_type_error: 'Kirjeldus peab olema tekst.',
      })
      .trim()
      .min(1, 'Sisesta kirjeldus.')
      .max(20000, 'Kirjeldus kuni 20 000 tähemärki.'),
    /** Shared with the service branch so contact rules cannot drift. */
    contact: serviceRequestContactSchema,
  })
  .strict({ message: 'Päring sisaldab lubamatuid välju.' })

export type SaleSubmission = z.infer<typeof saleSubmissionSchema>

/**
 * County for the created draft: the first cadastre decides. Delegates to
 * the shared helper instead of reimplementing the legacy-code mapping;
 * null means unmappable, and the route can fall back to the payload's
 * optional county field.
 */
export function deriveSaleCounty(cadastres: readonly string[]): string | null {
  return deriveCountyCodeFromCadastre(cadastres[0] ?? null)
}

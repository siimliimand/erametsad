import {
  hooldusraieRequestSchema,
  istutamineRequestSchema,
  kavaRequestSchema,
} from '@erametsad/types'
import { z } from 'zod'

/**
 * Service branch of the portal wizard (design D5). The per-type field rules
 * are reused from the shared service-request schemas, so the portal cannot
 * drift from the marketing form's validation. Each variant only gains the
 * module-wide `branch` discriminator here; `type` stays the inner
 * discriminator of the service-request contract.
 *
 * Unlike the sale schema, these variants are not `.strict()`: the shared
 * schemas strip unknown keys. The service route keeps validating with the
 * original schema (task 2.2), so extra fields never reach storage anyway.
 */

const branchService = z.literal('service', {
  errorMap: () => ({ message: 'Tundmatu esituse haru.' }),
})

export const serviceSubmissionSchema = z.discriminatedUnion('type', [
  kavaRequestSchema.extend({ branch: branchService }),
  hooldusraieRequestSchema.extend({ branch: branchService }),
  istutamineRequestSchema.extend({ branch: branchService }),
])

export type ServiceSubmission = z.infer<typeof serviceSubmissionSchema>

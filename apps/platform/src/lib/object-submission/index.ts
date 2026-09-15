import { z } from 'zod'

import { saleSubmissionSchema } from './sale-schema'
import { serviceSubmissionSchema } from './service-schema'

export * from './sale-schema'
export * from './service-schema'

/**
 * Both wizard branches behind one selector (design D5). A
 * z.discriminatedUnion('branch', ...) is not possible here: the three
 * service variants would all carry branch 'service', and zod v3 rejects
 * duplicate discriminator values in one union. A plain union keeps the
 * same output type; routes validate their branch-specific schema anyway.
 * The service variants keep their inner `type` discriminator from the
 * shared service-request schemas, and the admin wizard's superset schema
 * stays untouched.
 */
export const objectSubmissionSchema = z.union([saleSubmissionSchema, serviceSubmissionSchema])

export type ObjectSubmission = z.infer<typeof objectSubmissionSchema>

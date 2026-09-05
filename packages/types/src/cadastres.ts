import { z } from 'zod'

import { EECadastral } from './validators'

export interface CadastralParseIssue {
  readonly index: number
  readonly value: string
}

export interface CadastreParseResult {
  readonly cadastres: string[]
  readonly invalid: readonly CadastralParseIssue[]
}

const SEPARATORS = /[\s,]+/

export function splitCadastreInput(input: string | readonly string[]): string[] {
  const chunks = typeof input === 'string' ? [input] : input
  return chunks
    .flatMap((chunk) => chunk.split(SEPARATORS))
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

export function parseCadastres(input: string | readonly string[]): CadastreParseResult {
  const cadastres: string[] = []
  const invalid: CadastralParseIssue[] = []
  splitCadastreInput(input).forEach((value, index) => {
    if (EECadastral.safeParse(value).success) {
      cadastres.push(value)
    } else {
      invalid.push({ index: index + 1, value })
    }
  })
  return { cadastres, invalid }
}

export const EECadastralList = z
  .union([z.string(), z.array(z.string())], {
    errorMap: () => ({
      message: 'Sisestage katastriüksused eraldatuna komade või tühikutega',
    }),
  })
  .superRefine((input, ctx) => {
    const entries = splitCadastreInput(input)
    if (entries.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Sisestage vähemalt üks katastriüksus',
      })
      return
    }
    entries.forEach((entry, index) => {
      if (!EECadastral.safeParse(entry).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${String(index + 1)}. katastriüksus peab vastama vormingule NNNNN:NNN:NNNN`,
        })
      }
    })
  })
  .transform((input) => splitCadastreInput(input))

export type EECadastralListInput = z.input<typeof EECadastralList>
export type EECadastralListOutput = z.output<typeof EECadastralList>

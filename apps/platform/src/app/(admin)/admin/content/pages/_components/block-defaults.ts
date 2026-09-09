import { z } from 'zod'
import type { ZodTypeAny } from 'zod'

import { blockRegistry, type BlockConfig } from '@/lib/content/blocks'
import type { PageBlockType } from '@/lib/data/schema'

/**
 * Initial builder configs derived from the registry zod schemas, so a newly
 * added block always parses against its own type. Required object/array
 * children start empty and are completed in the settings drawer; zod
 * `.default()` values are honored through `_def.defaultValue`.
 */

export interface PeeledSchema {
  type: ZodTypeAny
  required: boolean
}

export function peelSchema(schema: ZodTypeAny): PeeledSchema {
  let type = schema
  let required = true
  for (;;) {
    if (
      type instanceof z.ZodDefault ||
      type instanceof z.ZodOptional ||
      type instanceof z.ZodNullable
    ) {
      required = false
      type = type._def.innerType as ZodTypeAny
      continue
    }
    return { type, required }
  }
}

export function defaultForSchema(schema: ZodTypeAny): unknown {
  return defaultValueForField(schema)
}

function defaultValueForField(field: ZodTypeAny): unknown {
  if (field instanceof z.ZodDefault) {
    return field._def.defaultValue()
  }
  if (field instanceof z.ZodOptional || field instanceof z.ZodNullable) {
    return undefined
  }
  const { type } = peelSchema(field)
  if (type instanceof z.ZodString) return ''
  if (type instanceof z.ZodNumber) return type.minValue ?? 0
  if (type instanceof z.ZodBoolean) return false
  if (type instanceof z.ZodLiteral) return type.value
  if (type instanceof z.ZodEnum) {
    const values = type.options as readonly string[]
    return values[0]
  }
  if (type instanceof z.ZodUnion) {
    const first = (type.options as readonly z.ZodTypeAny[])[0]
    return first === undefined ? undefined : defaultValueForField(first)
  }
  if (type instanceof z.ZodArray) return []
  if (type instanceof z.ZodObject) {
    const out: Record<string, unknown> = {}
    const shape = type.shape as Record<string, ZodTypeAny>
    for (const [key, child] of Object.entries(shape)) {
      const value = defaultValueForField(child)
      if (value !== undefined) out[key] = value
    }
    return out
  }
  return undefined
}

export function defaultConfigFor(type: PageBlockType): BlockConfig {
  return defaultForSchema(blockRegistry[type].schema) as BlockConfig
}

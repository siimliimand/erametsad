import { JsonFieldError } from './errors'

export type JsonFieldKind = 'json' | 'array'
export type JsonFieldSpec = Readonly<Record<string, JsonFieldKind>>

export function parseJsonText(field: string, raw: unknown, kind: JsonFieldKind): unknown {
  if (raw === null) {
    return null
  }
  if (typeof raw !== 'string') {
    throw new JsonFieldError(field, 'stored value is not TEXT')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (cause) {
    throw new JsonFieldError(field, 'stored value is not valid JSON', { cause })
  }
  if (kind === 'array' && !Array.isArray(parsed)) {
    throw new JsonFieldError(field, 'stored value is not a JSON array')
  }
  return parsed
}

export function stringifyJsonText(field: string, value: unknown): string | null {
  if (value === null) {
    return null
  }
  try {
    return JSON.stringify(value)
  } catch (cause) {
    throw new JsonFieldError(field, 'value is not JSON-serializable', { cause })
  }
}

export function decodeJsonFields(
  row: Record<string, unknown>,
  spec: JsonFieldSpec,
): Record<string, unknown> {
  const fields = Object.keys(spec)
  if (fields.length === 0) {
    return row
  }
  const doc: Record<string, unknown> = { ...row }
  for (const field of fields) {
    const kind = spec[field]
    if (!kind) {
      continue
    }
    if (doc[field] === undefined) {
      continue
    }
    doc[field] = parseJsonText(field, doc[field], kind)
  }
  return doc
}

export function encodeJsonFields(
  data: Record<string, unknown>,
  spec: JsonFieldSpec,
): Record<string, unknown> {
  const jsonFields = new Set(Object.keys(spec))
  if (jsonFields.size === 0) {
    return data
  }
  const encoded: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (jsonFields.has(key)) {
      if (value === undefined) {
        continue
      }
      encoded[key] = stringifyJsonText(key, value)
    } else {
      encoded[key] = value
    }
  }
  return encoded
}

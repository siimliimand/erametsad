import { z } from 'zod'

import { defaultForSchema, peelSchema } from './block-defaults'

import { blockRegistry } from '@/lib/content/blocks'
import type { PageBlockType } from '@/lib/data/schema'

/**
 * Form model for the settings drawer, derived from the registry zod schemas.
 * Zod supplies the field type, requiredness and bounds; the label tables
 * below carry the Estonian UI text (zod has no display metadata).
 */

export type BlockFieldDescriptor =
  | {
      kind: 'string'
      path: string
      label: string
      required: boolean
      multiline: boolean
      maxLength?: number
    }
  | {
      kind: 'number'
      path: string
      label: string
      required: boolean
      min?: number
      max?: number
    }
  | {
      kind: 'select'
      path: string
      label: string
      required: boolean
      options: { value: string; label: string }[]
    }
  | {
      kind: 'group'
      path: string
      label: string
      required: boolean
      fields: BlockFieldDescriptor[]
    }
  | {
      kind: 'array'
      path: string
      label: string
      required: boolean
      itemLabel: string
      addLabel: string
      min: number
      max?: number
      defaultItem: Record<string, unknown>
      fields: BlockFieldDescriptor[]
    }

const fieldLabels: Record<string, string> = {
  heading: 'Pealkiri',
  kicker: 'Ülainfo',
  body: 'Sisu',
  image: 'Pildi URL',
  primaryCta: 'Peamine nupp',
  secondaryCta: 'Teisejärguline nupp',
  label: 'Nupu tekst',
  href: 'Link',
  title: 'Pealkiri',
  description: 'Kirjeldus',
  intro: 'Sissejuhatus',
  columns: 'Veergude arv',
  items: 'Read',
  limit: 'Näidatavaid oksjoneid',
  linkLabel: 'Lingi tekst',
  linkHref: 'Lingi aadress',
  slug: 'Vormi slug',
  quote: 'Tsitaat',
  author: 'Autor',
  role: 'Roll',
  question: 'Küsimus',
  answer: 'Vastus',
  content: 'Sisu',
  value: 'Näitarv',
}

const multilineMinLength = 500

interface ArrayLabels {
  section: string
  item: string
  add: string
}

const arrayLabels: Partial<Record<PageBlockType, Record<string, ArrayLabels>>> = {
  cards: {
    items: { section: 'Kaardid', item: 'Kaart', add: 'Lisa kaart' },
  },
  accordion: {
    items: { section: 'Read', item: 'Rida', add: 'Lisa rida' },
  },
  stats: {
    items: { section: 'Näitarvud', item: 'Näitarv', add: 'Lisa näitarv' },
  },
  testimonials: {
    items: { section: 'Kliendilood', item: 'Kliendilugu', add: 'Lisa kliendilugu' },
  },
  faq: {
    items: { section: 'Küsimused', item: 'Küsimus', add: 'Lisa küsimus' },
  },
}

function labelFor(type: PageBlockType, path: string, key: string): string {
  return arrayLabels[type]?.[path]?.section ?? fieldLabels[key] ?? key
}

function literalValue(literal: z.ZodLiteral<unknown>): unknown {
  return literal.value
}

function stringDescriptor(
  type: PageBlockType,
  path: string,
  key: string,
  schema: z.ZodString,
  required: boolean,
): BlockFieldDescriptor {
  const maxLength = schema.maxLength ?? undefined
  return {
    kind: 'string',
    path,
    label: labelFor(type, path, key),
    required,
    multiline: (maxLength ?? 0) >= multilineMinLength,
    ...(maxLength !== undefined ? { maxLength } : {}),
  }
}

function selectDescriptor(
  type: PageBlockType,
  path: string,
  key: string,
  options: readonly z.ZodLiteral<unknown>[],
  required: boolean,
): BlockFieldDescriptor {
  return {
    kind: 'select',
    path,
    label: labelFor(type, path, key),
    required,
    options: options.map((option) => {
      const value = literalValue(option)
      // Veergude arv gets a unit; other literal unions fall back to the value.
      const label =
        path === 'columns' ? `${String(value)} veergu` : String(value)
      return { value: String(value), label }
    }),
  }
}

function descriptorForField(
  blockType: PageBlockType,
  path: string,
  key: string,
  schema: z.ZodTypeAny,
): BlockFieldDescriptor | null {
  const { type, required } = peelSchema(schema)
  if (type instanceof z.ZodString) {
    return stringDescriptor(blockType, path, key, type, required)
  }
  if (type instanceof z.ZodNumber) {
    const min = type.minValue ?? undefined
    const max = type.maxValue ?? undefined
    return {
      kind: 'number',
      path,
      label: labelFor(blockType, path, key),
      required,
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
    }
  }
  if (type instanceof z.ZodUnion) {
    const unionOptions = type.options as readonly z.ZodTypeAny[]
    const literals = unionOptions.filter(
      (option): option is z.ZodLiteral<unknown> => option instanceof z.ZodLiteral,
    )
    if (literals.length !== unionOptions.length) return null
    return selectDescriptor(blockType, path, key, literals, required)
  }
  if (type instanceof z.ZodObject) {
    return {
      kind: 'group',
      path,
      label: labelFor(blockType, path, key),
      required,
      fields: descriptorsForShape(blockType, type, path) ?? [],
    }
  }
  if (type instanceof z.ZodArray) {
    const labels = arrayLabels[blockType]?.[path]
    const itemFields = descriptorsForShape(
      blockType,
      type.element as z.ZodTypeAny,
      `${path}.`,
    )
    if (itemFields === null) return null
    const max = type._def.maxLength?.value ?? undefined
    return {
      kind: 'array',
      path,
      label: labelFor(blockType, path, key),
      required,
      itemLabel: labels?.item ?? key,
      addLabel: labels?.add ?? 'Lisa rida',
      min: type._def.minLength?.value ?? 0,
      ...(max !== undefined ? { max } : {}),
      defaultItem: defaultItemFor(type.element as z.ZodTypeAny),
      fields: itemFields,
    }
  }
  return null
}

function descriptorsForShape(
  blockType: PageBlockType,
  schema: z.ZodTypeAny,
  prefix: string,
): BlockFieldDescriptor[] | null {
  if (!(schema instanceof z.ZodObject)) return null
  const fields: BlockFieldDescriptor[] = []
  const shape = schema.shape as Record<string, z.ZodTypeAny>
  for (const [key, child] of Object.entries(shape)) {
    const descriptor = descriptorForField(blockType, `${prefix}${key}`, key, child)
    if (descriptor) fields.push(descriptor)
  }
  return fields
}

export function buildBlockFields(type: PageBlockType): BlockFieldDescriptor[] {
  return descriptorsForShape(type, blockRegistry[type].schema, '') ?? []
}

// --- Draft (unvalidated edit state) helpers -------------------------------
// Drafts are plain JSON (they round-trip through config_json), so updates
// clone-and-mutate instead of fighting immutable spreads through arrays.

export type BlockDraft = Record<string, unknown>

export function cloneDraft(config: unknown): BlockDraft {
  return JSON.parse(JSON.stringify(config)) as BlockDraft
}

function resolveAt(draft: unknown, path: string): unknown {
  let cursor: unknown = draft
  for (const segment of path.split('.')) {
    if (Array.isArray(cursor)) {
      cursor = cursor[Number(segment)]
    } else if (cursor !== null && typeof cursor === 'object') {
      cursor = (cursor as Record<string, unknown>)[segment]
    } else {
      return undefined
    }
  }
  return cursor
}

export function getDraftValue(draft: BlockDraft, path: string): unknown {
  return resolveAt(draft, path)
}

export function updateDraftValue(
  draft: BlockDraft,
  path: string,
  value: unknown,
): BlockDraft {
  const next = cloneDraft(draft)
  const segments = path.split('.')
  const key = segments[segments.length - 1]
  if (key === undefined) return next
  const parent = resolveAt(next, segments.slice(0, -1).join('.'))
  if (Array.isArray(parent)) {
    parent[Number(key)] = value
  } else if (parent !== null && typeof parent === 'object') {
    ;(parent as Record<string, unknown>)[key] = value
  }
  return next
}

export function appendDraftItem(
  draft: BlockDraft,
  path: string,
  item: unknown,
): BlockDraft {
  const next = cloneDraft(draft)
  const list = resolveAt(next, path)
  if (Array.isArray(list)) list.push(cloneDraft(item))
  return next
}

export function removeDraftItem(
  draft: BlockDraft,
  path: string,
  index: number,
): BlockDraft {
  const next = cloneDraft(draft)
  const list = resolveAt(next, path)
  if (Array.isArray(list) && list.length > index) list.splice(index, 1)
  return next
}

function defaultItemFor(schema: z.ZodTypeAny): Record<string, unknown> {
  const item = defaultForSchema(schema)
  return item !== null && typeof item === 'object' && !Array.isArray(item)
    ? (item as Record<string, unknown>)
    : {}
}

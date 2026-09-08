import type { z, ZodTypeAny } from 'zod'

import {
  accordionConfigSchema,
  cardsConfigSchema,
  ctaConfigSchema,
  faqConfigSchema,
  formConfigSchema,
  heroConfigSchema,
  statsConfigSchema,
  testimonialsConfigSchema,
  textConfigSchema,
  tickerConfigSchema,
} from './schemas'

import type { PageBlockType } from '@/lib/data/schema'

/**
 * Builder-facing metadata per block type. Labels and descriptions are
 * Estonian (admin UI); `icon` is a lucide icon name matching the admin demo.
 */
export interface BlockTypeMeta {
  readonly description: string
  readonly icon: string
}

export interface BlockTypeDefinition {
  readonly schema: ZodTypeAny
  readonly label: string
  readonly meta: BlockTypeMeta
}

// `satisfies` keeps each entry's concrete schema type, so BlockConfigOf below
// resolves per-type configs while the Record guarantees all 10 DB types exist.
export const blockRegistry = {
  hero: {
    schema: heroConfigSchema,
    label: 'Hero päis',
    meta: { description: 'Lehe pealdis pealkirja ja toimingunuppudega', icon: 'heading-2' },
  },
  text: {
    schema: textConfigSchema,
    label: 'Tekstiplokk',
    meta: { description: 'Pealkiri ja vabas vormis tekst', icon: 'type' },
  },
  cards: {
    schema: cardsConfigSchema,
    label: 'Kaardid',
    meta: { description: 'Kaardirida sammude või teenuste tutvustamiseks', icon: 'layout-grid' },
  },
  accordion: {
    schema: accordionConfigSchema,
    label: 'Akordion',
    meta: { description: 'Klappiv loend protsessi või teemade selgitamiseks', icon: 'list' },
  },
  form: {
    schema: formConfigSchema,
    label: 'Vorm',
    meta: { description: 'Juhtloimi või uudiskirja vorm olemasoleva slugi järgi', icon: 'clipboard-list' },
  },
  ticker: {
    schema: tickerConfigSchema,
    label: 'Oksjonite ticker',
    meta: { description: 'Aktiivsete oksjonite reaalajas loend', icon: 'activity' },
  },
  stats: {
    schema: statsConfigSchema,
    label: 'Statistikariba',
    meta: { description: 'Näitarvud usalduse toetamiseks', icon: 'chart-column' },
  },
  cta: {
    schema: ctaConfigSchema,
    label: 'CTA-riba',
    meta: { description: 'Kutsung riba ühe toimingunupuga', icon: 'megaphone' },
  },
  testimonials: {
    schema: testimonialsConfigSchema,
    label: 'Kliendilood',
    meta: { description: 'Klientide tsitaadid ja hinnangud', icon: 'quote' },
  },
  faq: {
    schema: faqConfigSchema,
    label: 'KKK',
    meta: { description: 'Korduma kippuvad küsimused vastustega', icon: 'help-circle' },
  },
} as const satisfies Record<PageBlockType, BlockTypeDefinition>

export type BlockTypeSlug = keyof typeof blockRegistry

export type BlockConfigOf<T extends PageBlockType> = z.infer<
  (typeof blockRegistry)[T]['schema']
>

export type BlockConfig = {
  [T in PageBlockType]: BlockConfigOf<T>
}[PageBlockType]

export function getBlockTypeDefinition(type: PageBlockType): BlockTypeDefinition {
  return blockRegistry[type]
}

export function getBlockTypeLabel(type: PageBlockType): string {
  return blockRegistry[type].label
}

export function listBlockTypes(): BlockTypeDefinition[] {
  return Object.values(blockRegistry)
}

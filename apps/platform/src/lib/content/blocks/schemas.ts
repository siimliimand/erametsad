import { z } from 'zod'

/**
 * Per-type zod contracts for `page_blocks.config_json`. Field sets mirror the
 * admin demo block editor (docs/design/demo/admin/11) and the marketing page
 * sections the renderer (task 12.6) must reproduce.
 */

export const ctaLinkSchema = z.object({
  label: z
    .string({ required_error: 'Nupu tekst on kohustuslik.' })
    .trim()
    .min(1, 'Nupu tekst on kohustuslik.')
    .max(100),
  href: z
    .string({ required_error: 'Nupu link on kohustuslik.' })
    .trim()
    .min(1, 'Nupu link on kohustuslik.')
    .max(1000),
})

// required_error keeps the Estonian message for fully missing fields too
// (zod's default is the English "Required").
const shortText = (message: string) =>
  z.string({ required_error: message }).trim().min(1, message).max(200)
const bodyText = (message: string) =>
  z.string({ required_error: message }).trim().min(1, message).max(5000)
const optionalImage = z.string().max(1000).optional()

/** Lucide icon names the card ikoon select offers (renderer keeps the map). */
export const cardIconNames = [
  'trees',
  'axe',
  'sprout',
  'map',
  'shield',
  'clock',
  'coins',
  'file-text',
] as const

/** Object-type filter values; 'koik' disables the filter. */
export const tickerObjectTypes = ['koik', 'raieoigus', 'kinnistu', 'kiire', 'pakett'] as const

/** Lead-form kinds from the CMS spec (mapped to LeadForm slugs at render time). */
export const formTypes = ['pohivorm', 'kava', 'hooldusraie', 'istutamine'] as const

/** Form block placement: card panel or plain light background. */
export const formPaigutus = ['kaardil', 'heledal'] as const

/** Per-stat suffixes from the CMS spec; statValue carries the digits only. */
export const statSuffixes = ['+', '%', '€'] as const

/** 'staatiline' renders the stored value; 'live' is resolved by the caller. */
export const statSources = ['staatiline', 'live'] as const

/** CTA band styles: amber banner or the default green one. */
export const ctaStyles = ['amber', 'green'] as const

export const heroConfigSchema = z.object({
  kicker: z.string().trim().max(100).optional(),
  heading: shortText('Hero pealkiri on kohustuslik.'),
  // CMS spec: intro capped at 300 characters.
  body: z
    .string()
    .trim()
    .max(300, 'Sissejuhatus võib olla kuni 300 tähemärki.')
    .optional(),
  // Overlay strength over the hero background, 0–80% (spec 11).
  overlayStrength: z.number().int().min(0).max(80).default(80),
  image: optionalImage,
  primaryCta: ctaLinkSchema,
  secondaryCta: ctaLinkSchema.optional(),
})

export const textConfigSchema = z.object({
  heading: z.string().trim().max(200).optional(),
  // Paragraphs are newline-separated; the renderer splits on blank lines.
  body: bodyText('Teksti sisu on kohustuslik.'),
})

export const cardItemSchema = z.object({
  title: shortText('Kaardi pealkiri on kohustuslik.'),
  // Lucide icon name from the ikoon select (spec 11); optional.
  icon: z.enum(cardIconNames).optional(),
  // Newline-separated bullet lines, as in the process cards on avaleht.
  description: z.string().trim().max(2000).optional(),
  href: z.string().max(1000).optional(),
})

export const cardsConfigSchema = z.object({
  heading: z.string().trim().max(200).optional(),
  intro: z.string().trim().max(1000).optional(),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  // CMS spec caps cards at three items (items[1–3]).
  items: z.array(cardItemSchema).min(1, 'Lisa vähemalt üks kaart.').max(3, 'Kaarte võib olla kuni 3.'),
})

export const accordionItemSchema = z.object({
  title: shortText('Akordioni pealkiri on kohustuslik.'),
  content: bodyText('Akordioni sisu on kohustuslik.'),
  // Per-item "avatud vaikimisi" flag (spec 11).
  defaultOpen: z.boolean().optional(),
})

export const accordionConfigSchema = z.object({
  heading: z.string().trim().max(200).optional(),
  items: z.array(accordionItemSchema).min(1, 'Lisa vähemalt üks rida.').max(20),
})

export const formConfigSchema = z.object({
  heading: z.string().trim().max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  // Form-kind select from the CMS spec; slug stays the LeadForm target.
  type: z.enum(formTypes).default('pohivorm'),
  paigutus: z.enum(formPaigutus).default('kaardil'),
  slug: shortText('Vormi slug on kohustuslik.'),
})

export const tickerConfigSchema = z.object({
  heading: z.string().trim().max(200).optional(),
  linkLabel: z.string().trim().max(100).optional(),
  linkHref: z.string().max(1000).optional(),
  // CMS spec: 2–8 cards.
  limit: z.number().int().min(2, 'Vähemalt 2 oksjonit.').max(8, 'Kuni 8 oksjonit.').default(4),
  // Object-type filter; 'koik' disables filtering.
  objectType: z.enum(tickerObjectTypes).default('koik'),
  // Auto-refresh interval in seconds; 0 disables it.
  autoRefreshSeconds: z.number().int().min(0).max(3600).default(0),
})

export const statItemSchema = z.object({
  label: shortText('Näitarvu kirjeldus on kohustuslik.'),
  // String so the admin can write "12 500" directly; suffix adds +/€/%.
  value: z.string().trim().min(1, 'Näitarv on kohustuslik.').max(60),
  suffix: z.enum(statSuffixes).optional(),
  // Live-metric select per spec 11; 'staatiline' renders the stored value.
  source: z.enum(statSources).default('staatiline'),
})

export const statsConfigSchema = z.object({
  heading: z.string().trim().max(200).optional(),
  items: z.array(statItemSchema).min(1, 'Lisa vähemalt üks näitarv.').max(6),
})

export const ctaConfigSchema = z.object({
  heading: shortText('CTA tekst on kohustuslik.'),
  body: z.string().trim().max(500).optional(),
  cta: ctaLinkSchema,
  // Band style from spec 11: amber banner or the default green one.
  style: z.enum(ctaStyles).default('green'),
})

/**
 * Testimonials render from the `testimonials` collection (published rows
 * only, newest first): the block picks how many to show and the marketing
 * route supplies the items, mirroring the ticker/stats live-data flow.
 */
export const testimonialsConfigSchema = z.object({
  heading: z.string().trim().max(200).optional(),
  limit: z
    .number()
    .int()
    .min(1, 'Vähemalt 1 kliendilugu.')
    .max(12, 'Kuni 12 kliendilugu.')
    .default(6),
})

export const faqItemSchema = z.object({
  question: shortText('Küsimus on kohustuslik.'),
  answer: bodyText('Vastus on kohustuslik.'),
})

export const faqConfigSchema = z.object({
  heading: z.string().trim().max(200).optional(),
  items: z.array(faqItemSchema).min(1, 'Lisa vähemalt üks küsimus.').max(30),
})

export type CtaLinkConfig = z.infer<typeof ctaLinkSchema>
export type HeroConfig = z.infer<typeof heroConfigSchema>
export type TextConfig = z.infer<typeof textConfigSchema>
export type CardsConfig = z.infer<typeof cardsConfigSchema>
export type AccordionConfig = z.infer<typeof accordionConfigSchema>
export type FormConfig = z.infer<typeof formConfigSchema>
export type TickerConfig = z.infer<typeof tickerConfigSchema>
export type StatsConfig = z.infer<typeof statsConfigSchema>
export type CtaConfig = z.infer<typeof ctaConfigSchema>
export type TestimonialsConfig = z.infer<typeof testimonialsConfigSchema>
export type FaqConfig = z.infer<typeof faqConfigSchema>

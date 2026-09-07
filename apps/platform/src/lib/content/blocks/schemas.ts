import { z } from 'zod'

/**
 * Per-type zod contracts for `page_blocks.config_json`. Field sets mirror the
 * admin demo block editor (docs/design/demo/admin/11) and the marketing page
 * sections the renderer (task 12.6) must reproduce.
 */

export const ctaLinkSchema = z.object({
  label: z.string().min(1, 'Nupu tekst on kohustuslik.').max(100),
  href: z.string().min(1, 'Nupu link on kohustuslik.').max(1000),
})

const shortText = (message: string) => z.string().trim().min(1, message).max(200)
const bodyText = (message: string) => z.string().trim().min(1, message).max(5000)
const optionalImage = z.string().max(1000).optional()

export const heroConfigSchema = z.object({
  kicker: z.string().trim().max(100).optional(),
  heading: shortText('Hero pealkiri on kohustuslik.'),
  body: z.string().trim().max(1000).optional(),
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
  // Newline-separated bullet lines, as in the process cards on avaleht.
  description: z.string().trim().max(2000).optional(),
  href: z.string().max(1000).optional(),
})

export const cardsConfigSchema = z.object({
  heading: z.string().trim().max(200).optional(),
  intro: z.string().trim().max(1000).optional(),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  items: z.array(cardItemSchema).min(1, 'Lisa vähemalt üks kaart.').max(12),
})

export const accordionItemSchema = z.object({
  title: shortText('Akordioni pealkiri on kohustuslik.'),
  content: bodyText('Akordioni sisu on kohustuslik.'),
})

export const accordionConfigSchema = z.object({
  heading: z.string().trim().max(200).optional(),
  items: z.array(accordionItemSchema).min(1, 'Lisa vähemalt üks rida.').max(20),
})

export const formConfigSchema = z.object({
  heading: z.string().trim().max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  slug: shortText('Vormi slug on kohustuslik.'),
})

export const tickerConfigSchema = z.object({
  heading: z.string().trim().max(200).optional(),
  linkLabel: z.string().trim().max(100).optional(),
  linkHref: z.string().max(1000).optional(),
  limit: z.number().int().min(1).max(10).default(4),
})

export const statItemSchema = z.object({
  label: shortText('Näitarvu kirjeldus on kohustuslik.'),
  // String so the admin can write "12 500+" or "€" suffixes directly.
  value: z.string().trim().min(1, 'Näitarv on kohustuslik.').max(60),
})

export const statsConfigSchema = z.object({
  heading: z.string().trim().max(200).optional(),
  items: z.array(statItemSchema).min(1, 'Lisa vähemalt üks näitarv.').max(6),
})

export const ctaConfigSchema = z.object({
  heading: shortText('CTA tekst on kohustuslik.'),
  body: z.string().trim().max(500).optional(),
  cta: ctaLinkSchema,
})

export const testimonialItemSchema = z.object({
  quote: bodyText('Kliendiloo tsitaat on kohustuslik.').max(2000),
  author: shortText('Autori nimi on kohustuslik.'),
  role: z.string().trim().max(200).optional(),
  image: optionalImage,
})

export const testimonialsConfigSchema = z.object({
  heading: z.string().trim().max(200).optional(),
  items: z.array(testimonialItemSchema).min(1, 'Lisa vähemalt üks kliendilugu.').max(12),
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

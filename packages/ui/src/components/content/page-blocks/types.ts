/**
 * Renderer-owned view types for the CMS page blocks. The shapes mirror the
 * platform block registry's zod configs without importing it: the ui package
 * must not depend on the app, and the caller (marketing route, admin preview)
 * owns authoritative validation. The guards in guards.ts are a defensive
 * second net so one malformed config can never break a page render.
 */

import type { LotCardProps } from '../LotCard'

export interface PageBlockView {
  /** Stable key from the `page_blocks` row; also namespaces accordion ids. */
  id: string
  type: string
  config: unknown
}

export interface BlockLinkConfig {
  label: string
  href: string
}

export interface HeroBlockConfig {
  heading: string
  kicker?: string
  body?: string
  image?: string
  primaryCta: BlockLinkConfig
  secondaryCta?: BlockLinkConfig
}

export interface TextBlockConfig {
  heading?: string
  body: string
}

export interface CardItemConfig {
  title: string
  description?: string
  href?: string
}

export interface CardsBlockConfig {
  heading?: string
  intro?: string
  columns?: 2 | 3 | 4
  items: CardItemConfig[]
}

export interface AccordionItemConfig {
  title: string
  content: string
}

export interface AccordionBlockConfig {
  heading?: string
  items: AccordionItemConfig[]
}

export interface FormBlockConfig {
  heading?: string
  description?: string
  slug: string
}

export interface TickerBlockConfig {
  heading?: string
  linkLabel?: string
  linkHref?: string
  limit?: number
}

export interface StatItemConfig {
  value: string
  label: string
}

export interface StatsBlockConfig {
  heading?: string
  items: StatItemConfig[]
}

export interface CtaBlockConfig {
  heading: string
  body?: string
  cta: BlockLinkConfig
}

export interface TestimonialItemConfig {
  quote: string
  author: string
  role?: string
  image?: string
}

export interface TestimonialsBlockConfig {
  heading?: string
  items: TestimonialItemConfig[]
}

export interface FaqItemConfig {
  question: string
  answer: string
}

export interface FaqBlockConfig {
  heading?: string
  items: FaqItemConfig[]
}

export type ResolvedBlockConfig =
  | { type: 'hero'; config: HeroBlockConfig }
  | { type: 'text'; config: TextBlockConfig }
  | { type: 'cards'; config: CardsBlockConfig }
  | { type: 'accordion'; config: AccordionBlockConfig }
  | { type: 'form'; config: FormBlockConfig }
  | { type: 'ticker'; config: TickerBlockConfig }
  | { type: 'stats'; config: StatsBlockConfig }
  | { type: 'cta'; config: CtaBlockConfig }
  | { type: 'testimonials'; config: TestimonialsBlockConfig }
  | { type: 'faq'; config: FaqBlockConfig }

export interface PageBlocksProps {
  /** Blocks in `ordinal` order; unknown types and invalid configs are skipped. */
  blocks: readonly PageBlockView[]
  /**
   * Preloaded lots for `ticker` blocks, sliced per block limit. The renderer
   * is presentation-only and never fetches; callers decide whether live data
   * exists at all.
   */
  tickerLots?: readonly LotCardProps[]
}

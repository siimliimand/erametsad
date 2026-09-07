/**
 * Structural guards for the block view configs. The authoritative validation
 * is the platform registry's zod parse (run by the marketing route); these
 * checks only keep the renderer itself from crashing on a shape that slipped
 * through (draft preview data, schema drift). A block that fails here is
 * skipped, never thrown.
 */

import type {
  AccordionBlockConfig,
  AccordionItemConfig,
  BlockLinkConfig,
  CardItemConfig,
  CardsBlockConfig,
  CtaBlockConfig,
  FaqBlockConfig,
  FaqItemConfig,
  FormBlockConfig,
  HeroBlockConfig,
  PageBlockView,
  ResolvedBlockConfig,
  StatItemConfig,
  StatsBlockConfig,
  TestimonialItemConfig,
  TestimonialsBlockConfig,
  TextBlockConfig,
  TickerBlockConfig,
} from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Non-empty string; the only "truthy text" notion the renderer relies on. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function requiredText(value: unknown): string | null {
  return text(value) ?? null
}

function link(value: unknown): BlockLinkConfig | null {
  if (!isRecord(value)) return null
  const label = requiredText(value.label)
  const href = text(value.href)
  return label !== null && href !== undefined ? { label, href } : null
}

/** Keeps only well-formed entries; an item list can shrink below its cap. */
function items<T>(value: unknown, parse: (entry: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return []
  return value.map(parse).filter((entry): entry is T => entry !== null)
}

function heroConfig(raw: unknown): HeroBlockConfig | null {
  if (!isRecord(raw)) return null
  const heading = requiredText(raw.heading)
  const primaryCta = link(raw.primaryCta)
  if (heading === null || primaryCta === null) return null
  const kicker = text(raw.kicker)
  const body = text(raw.body)
  const image = text(raw.image)
  const secondaryCta = link(raw.secondaryCta)
  return {
    heading,
    primaryCta,
    ...(kicker !== undefined ? { kicker } : {}),
    ...(body !== undefined ? { body } : {}),
    ...(image !== undefined ? { image } : {}),
    ...(secondaryCta !== null ? { secondaryCta } : {}),
  }
}

function textConfig(raw: unknown): TextBlockConfig | null {
  if (!isRecord(raw)) return null
  const body = requiredText(raw.body)
  if (body === null) return null
  const heading = text(raw.heading)
  return {
    body,
    ...(heading !== undefined ? { heading } : {}),
  }
}

function cardItem(raw: unknown): CardItemConfig | null {
  if (!isRecord(raw)) return null
  const title = requiredText(raw.title)
  if (title === null) return null
  const description = text(raw.description)
  const href = text(raw.href)
  return {
    title,
    ...(description !== undefined ? { description } : {}),
    ...(href !== undefined ? { href } : {}),
  }
}

function cardsConfig(raw: unknown): CardsBlockConfig | null {
  if (!isRecord(raw)) return null
  const parsed = items(raw.items, cardItem)
  if (parsed.length === 0) return null
  const heading = text(raw.heading)
  const intro = text(raw.intro)
  return {
    items: parsed,
    columns: raw.columns === 2 || raw.columns === 4 ? raw.columns : 3,
    ...(heading !== undefined ? { heading } : {}),
    ...(intro !== undefined ? { intro } : {}),
  }
}

function accordionItem(raw: unknown): AccordionItemConfig | null {
  if (!isRecord(raw)) return null
  const title = requiredText(raw.title)
  const content = requiredText(raw.content)
  return title !== null && content !== null ? { title, content } : null
}

function accordionConfig(raw: unknown): AccordionBlockConfig | null {
  if (!isRecord(raw)) return null
  const parsed = items(raw.items, accordionItem)
  if (parsed.length === 0) return null
  const heading = text(raw.heading)
  return {
    items: parsed,
    ...(heading !== undefined ? { heading } : {}),
  }
}

function formConfig(raw: unknown): FormBlockConfig | null {
  if (!isRecord(raw)) return null
  const slug = requiredText(raw.slug)
  if (slug === null) return null
  const heading = text(raw.heading)
  const description = text(raw.description)
  return {
    slug,
    ...(heading !== undefined ? { heading } : {}),
    ...(description !== undefined ? { description } : {}),
  }
}

function tickerConfig(raw: unknown): TickerBlockConfig {
  if (!isRecord(raw)) return { limit: 4 }
  const heading = text(raw.heading)
  const linkLabel = text(raw.linkLabel)
  const linkHref = text(raw.linkHref)
  const limit =
    typeof raw.limit === 'number' && Number.isInteger(raw.limit) && raw.limit >= 1
      ? Math.min(raw.limit, 10)
      : 4
  return {
    limit,
    ...(heading !== undefined ? { heading } : {}),
    ...(linkLabel !== undefined ? { linkLabel } : {}),
    ...(linkHref !== undefined ? { linkHref } : {}),
  }
}

function statItem(raw: unknown): StatItemConfig | null {
  if (!isRecord(raw)) return null
  const value = requiredText(raw.value)
  const label = requiredText(raw.label)
  return value !== null && label !== null ? { value, label } : null
}

function statsConfig(raw: unknown): StatsBlockConfig | null {
  if (!isRecord(raw)) return null
  const parsed = items(raw.items, statItem)
  if (parsed.length === 0) return null
  const heading = text(raw.heading)
  return {
    items: parsed,
    ...(heading !== undefined ? { heading } : {}),
  }
}

function ctaConfig(raw: unknown): CtaBlockConfig | null {
  if (!isRecord(raw)) return null
  const heading = requiredText(raw.heading)
  const cta = link(raw.cta)
  if (heading === null || cta === null) return null
  const body = text(raw.body)
  return {
    heading,
    cta,
    ...(body !== undefined ? { body } : {}),
  }
}

function testimonialItem(raw: unknown): TestimonialItemConfig | null {
  if (!isRecord(raw)) return null
  const quote = requiredText(raw.quote)
  const author = requiredText(raw.author)
  if (quote === null || author === null) return null
  const role = text(raw.role)
  const image = text(raw.image)
  return {
    quote,
    author,
    ...(role !== undefined ? { role } : {}),
    ...(image !== undefined ? { image } : {}),
  }
}

function testimonialsConfig(raw: unknown): TestimonialsBlockConfig | null {
  if (!isRecord(raw)) return null
  const parsed = items(raw.items, testimonialItem)
  if (parsed.length === 0) return null
  const heading = text(raw.heading)
  return {
    items: parsed,
    ...(heading !== undefined ? { heading } : {}),
  }
}

function faqItem(raw: unknown): FaqItemConfig | null {
  if (!isRecord(raw)) return null
  const question = requiredText(raw.question)
  const answer = requiredText(raw.answer)
  return question !== null && answer !== null ? { question, answer } : null
}

function faqConfig(raw: unknown): FaqBlockConfig | null {
  if (!isRecord(raw)) return null
  const parsed = items(raw.items, faqItem)
  if (parsed.length === 0) return null
  const heading = text(raw.heading)
  return {
    items: parsed,
    ...(heading !== undefined ? { heading } : {}),
  }
}

/**
 * Maps one block view onto its typed config, or null when the type is
 * unknown or the config misses a required field.
 */
export function resolveBlockConfig(view: PageBlockView): ResolvedBlockConfig | null {
  switch (view.type) {
    case 'hero': {
      const config = heroConfig(view.config)
      return config !== null ? { type: 'hero', config } : null
    }
    case 'text': {
      const config = textConfig(view.config)
      return config !== null ? { type: 'text', config } : null
    }
    case 'cards': {
      const config = cardsConfig(view.config)
      return config !== null ? { type: 'cards', config } : null
    }
    case 'accordion': {
      const config = accordionConfig(view.config)
      return config !== null ? { type: 'accordion', config } : null
    }
    case 'form': {
      const config = formConfig(view.config)
      return config !== null ? { type: 'form', config } : null
    }
    case 'ticker':
      return { type: 'ticker', config: tickerConfig(view.config) }
    case 'stats': {
      const config = statsConfig(view.config)
      return config !== null ? { type: 'stats', config } : null
    }
    case 'cta': {
      const config = ctaConfig(view.config)
      return config !== null ? { type: 'cta', config } : null
    }
    case 'testimonials': {
      const config = testimonialsConfig(view.config)
      return config !== null ? { type: 'testimonials', config } : null
    }
    case 'faq': {
      const config = faqConfig(view.config)
      return config !== null ? { type: 'faq', config } : null
    }
    default:
      return null
  }
}

import { marketingUrl } from './base-url'

// Shared schema.org JSON-LD builders for marketing pages. Builders are pure;
// pages render their result with the one documented pattern:
//   <script
//     type="application/ld+json"
//     dangerouslySetInnerHTML={{ __html: toJsonLdScript(data) }}
//   />

// Escapes '<' so CMS-sourced strings cannot close the script tag early.
export function toJsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export interface OrganizationJsonLdInput {
  name: string
  url: string
  address: string | null
  sameAs: string[]
}

export function buildOrganizationJsonLd(
  input: OrganizationJsonLdInput,
): Record<string, unknown> {
  const org: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: input.name,
    url: input.url,
  }
  if (input.address) {
    org.address = {
      '@type': 'PostalAddress',
      streetAddress: input.address,
      addressCountry: 'EE',
    }
  }
  if (input.sameAs.length > 0) {
    org.sameAs = input.sameAs
  }
  return org
}

export interface ServiceOfferJsonLd {
  price: number
  priceCurrency: string
  description: string
}

export interface ServiceJsonLdInput {
  name: string
  description?: string
  url?: string
  offers?: ServiceOfferJsonLd
}

export function buildServiceJsonLd(
  input: ServiceJsonLdInput,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    areaServed: 'Eesti',
    provider: {
      '@type': 'Organization',
      name: 'Eametsad',
      url: marketingUrl('/'),
    },
    ...(input.url ? { url: input.url } : {}),
    ...(input.offers
      ? { offers: { '@type': 'Offer', ...input.offers } }
      : {}),
  }
}

export interface BreadcrumbItemJsonLd {
  name: string
  /** Root-relative path; resolved to an absolute marketing-host URL. */
  path: string
}

export function buildBreadcrumbJsonLd(
  items: readonly BreadcrumbItemJsonLd[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: marketingUrl(item.path),
    })),
  }
}

export interface FaqJsonLdEntry {
  question: string
  answer: string
}

export function buildFaqPageJsonLd(
  entries: FaqJsonLdEntry[],
  pageUrl: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url: pageUrl,
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  }
}

export interface HowToStepJsonLdInput {
  title: string
  text: string
}

export function buildHowToJsonLd(input: {
  name: string
  description: string
  steps: readonly HowToStepJsonLdInput[]
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: input.name,
    description: input.description,
    step: input.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.title,
      text: step.text,
    })),
  }
}

export function buildItemListJsonLd(
  items: readonly { name: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
    })),
  }
}

export function buildCollectionPageJsonLd(input: {
  name: string
  /** Root-relative path; resolved to an absolute marketing-host URL. */
  path: string
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.name,
    url: marketingUrl(input.path),
  }
}

export interface ArticleJsonLdInput {
  headline: string
  /** Root-relative path of the article; becomes mainEntityOfPage. */
  path: string
  publishedAt?: string | null
  author?: string | null
}

export function buildArticleJsonLd(
  input: ArticleJsonLdInput,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    ...(input.publishedAt && { datePublished: input.publishedAt }),
    ...(input.author && { author: { '@type': 'Person', name: input.author } }),
    mainEntityOfPage: marketingUrl(input.path),
    publisher: {
      '@type': 'Organization',
      name: 'Eametsad',
      url: marketingUrl('/'),
    },
  }
}

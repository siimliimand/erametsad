export interface FaqJsonLdEntry {
  question: string
  answer: string
}

/**
 * Builds a schema.org FAQPage graph from visible FAQ items only. Kept as a
 * small pure function so task 6.1 can move it into a shared jsonld helper
 * without touching page code.
 */
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

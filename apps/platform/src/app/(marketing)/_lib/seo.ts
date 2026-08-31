import type { Metadata } from 'next'

import { marketingUrl } from './base-url'

export type OpenGraphType = 'website' | 'article'

export interface BuildMetadataInput {
  title: string
  description: string
  /** Root-relative path ('/', '/kkk'); canonical and og:url resolve to the marketing host. */
  path: string
  /** Bypasses the layout's '%s | Eametsad' template (home page). */
  absoluteTitle?: boolean
  ogType?: OpenGraphType
}

// Single source for marketing page metadata so every page emits the same
// title/description/canonical/OpenGraph shape with marketing-host URLs
// (base-url.ts), consistent with the layout's metadataBase.
export function buildMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  ogType = 'website',
}: BuildMetadataInput): Metadata {
  const url = marketingUrl(path)
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Eametsad',
      locale: 'et_EE',
      type: ogType,
    },
  }
}

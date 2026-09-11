/**
 * Sotsiaalsed lingid (task 5.1): the portal footer social URLs. The settings
 * row has no dedicated columns for them, so the three keys live additively
 * at the top level of the existing `featureFlags` TEXT-JSON column (same
 * reserved-key pattern as auctionDefaults and the integration secrets);
 * every flags merge keeps unknown keys, so the other sections never clobber
 * them.
 */

export const socialNetworks = ['facebook', 'instagram', 'youtube'] as const
export type SocialNetwork = (typeof socialNetworks)[number]

export const socialLinkFields: readonly {
  network: SocialNetwork
  key: string
  label: string
}[] = [
  { network: 'facebook', key: 'social.facebook_url', label: 'Facebook' },
  { network: 'instagram', key: 'social.instagram_url', label: 'Instagram' },
  { network: 'youtube', key: 'social.youtube_url', label: 'YouTube' },
]

export type SocialLinkUrls = Record<SocialNetwork, string>

/** Tolerant read: blank or non-string values normalize to ''. */
export function readSocialLinkUrls(flags: unknown): SocialLinkUrls {
  const source =
    typeof flags === 'object' && flags !== null && !Array.isArray(flags)
      ? (flags as Record<string, unknown>)
      : {}
  const urls = {} as SocialLinkUrls
  for (const field of socialLinkFields) {
    const value = source[field.key]
    urls[field.network] =
      typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''
  }
  return urls
}

export type ParseSocialLinksResult =
  | { ok: true; value: SocialLinkUrls }
  | { ok: false; error: string }

const socialUrlHints: Record<SocialNetwork, string> = {
  facebook: 'https://facebook.com/erametsad',
  instagram: 'https://instagram.com/erametsad',
  youtube: 'https://youtube.com/@erametsad',
}

// Genitive forms for the Estonian validation messages (YouTube needs the
// apostrophe; Facebook/Instagram decline without one).
const socialUrlGenitives: Record<SocialNetwork, string> = {
  facebook: 'Facebooki',
  instagram: 'Instagrami',
  youtube: 'YouTube\u2019i',
}

function socialUrlError(network: SocialNetwork): string {
  return `${socialUrlGenitives[network]} link peab olema korrektne URL (näiteks ${socialUrlHints[network]}).`
}

/**
 * Server-side validation (never trust the client): empty unsets the icon;
 * a filled field must parse as an absolute http(s) URL.
 */
export function parseSocialLinkUrls(input: SocialLinkUrls): ParseSocialLinksResult {
  const value = {} as SocialLinkUrls
  for (const field of socialLinkFields) {
    const raw = input[field.network].trim()
    if (raw.length === 0) {
      value[field.network] = ''
      continue
    }
    let parsed: URL
    try {
      parsed = new URL(raw)
    } catch {
      return { ok: false, error: socialUrlError(field.network) }
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, error: socialUrlError(field.network) }
    }
    value[field.network] = raw
  }
  return { ok: true, value }
}

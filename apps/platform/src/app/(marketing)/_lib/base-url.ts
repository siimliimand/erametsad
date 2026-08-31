import { DEFAULT_HOSTNAME } from '@/lib/routing/host-areas'

// Design D7: every marketing page canonicalizes to the default host, even
// when it renders on the portal host or a preview domain. The hostname has
// one source of truth in routing/host-areas.ts; NEXT_PUBLIC_APP_URL only
// supplies the scheme when it already serves the default host.
function resolveMarketingOrigin(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    try {
      const parsed = new URL(appUrl)
      if (parsed.hostname === DEFAULT_HOSTNAME) return parsed.origin
    } catch {
      // Unparseable URL: fall through to the canonical constant.
    }
  }
  return `https://${DEFAULT_HOSTNAME}`
}

export const MARKETING_BASE_URL = resolveMarketingOrigin()

// Builds an absolute canonical URL from a root-relative path ('/', '/kkk').
export function marketingUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return suffix === '/' ? MARKETING_BASE_URL : `${MARKETING_BASE_URL}${suffix}`
}

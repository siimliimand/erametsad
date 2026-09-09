/**
 * Env-backed integration key cards (demo 13-settings "Integratsioonid").
 * Values live only in environment variables (a rotated override lives in
 * the settings featureFlags JSON): the UI shows the variable name plus a
 * configured/unconfigured dot, and the audited settings.key_reveal action
 * is the single return path for raw values.
 *
 * Each card also carries a connection probe descriptor used by the
 * "Testi ühendust" action: either a credential presence check (env vars
 * only, no live call) or a lightweight HTTP GET to the service endpoint.
 */

/** Reserved keys inside the settings featureFlags TEXT-JSON column
 * (same additive pattern as the auctionDefaults key). Secrets are stored
 * write-only: the action never renders them back into props or audit. */
export const INTEGRATION_CHECKS_FLAGS_KEY = 'integrationChecks'
export const INTEGRATION_SECRETS_FLAGS_KEY = 'integrationKeySecrets'

export interface IntegrationPresenceProbe {
  kind: 'presence'
  /** Env vars that must all be non-empty for the probe to pass. */
  envVars: readonly string[]
}

export interface IntegrationHttpProbe {
  kind: 'http'
  /** Env vars that must all be non-empty before any live call is made. */
  envVars: readonly string[]
  /** Endpoint fetched with GET when the probe runs. */
  url: string
  /** Env var whose value replaces url when set (custom tile server etc.). */
  urlEnvVar?: string
  /** Env var whose value is sent as a Bearer token, when the service has one. */
  bearerEnvVar?: string
}

export type IntegrationProbe = IntegrationPresenceProbe | IntegrationHttpProbe

export interface IntegrationKeyDefinition {
  id: string
  label: string
  envVar: string
  description: string
  /** Probe for "Testi ühendust"; omitted keys fall back to an env-presence
   * check of envVar. */
  probe?: IntegrationProbe
}

/** Last connection-test result persisted per key under the checks key. */
export interface IntegrationCheckState {
  checkedAt: string
  latencyMs: number
  ok: boolean
  error?: string
}

export const integrationKeyDefinitions: readonly IntegrationKeyDefinition[] = [
  {
    id: 'eideasy',
    label: 'eID Easy API võti',
    envVar: 'EIDEASY_SECRET',
    description: 'eID (Smart-ID, Mobile-ID, ID-kaart) autentimispäringute võti.',
    probe: { kind: 'presence', envVars: ['EIDEASY_SECRET'] },
  },
  {
    id: 'cloudflare-email',
    label: 'Cloudflare Email API võti',
    envVar: 'CLOUDFLARE_EMAIL_TOKEN',
    description: 'Süsteemi e-kirjade saatmise võti (peamine transpordikanal).',
    probe: {
      kind: 'http',
      envVars: ['CLOUDFLARE_EMAIL_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
      url: 'https://api.cloudflare.com/client/v4/user/tokens/verify',
      bearerEnvVar: 'CLOUDFLARE_EMAIL_TOKEN',
    },
  },
  {
    id: 'smtp',
    label: 'SMTP salasõna',
    envVar: 'SMTP_PASS',
    description: 'Kohaliku SMTP varulülituse salasõna (nt Mailpit arenduses).',
    probe: { kind: 'presence', envVars: ['SMTP_PASS'] },
  },
  {
    id: 'ariregister',
    label: 'Äriregister API võti',
    envVar: 'ARIREGISTER_API_KEY',
    description: 'Äriregistriga sidumise võti (ettevõtteandmete pärimine).',
    probe: { kind: 'presence', envVars: ['ARIREGISTER_API_KEY'] },
  },
  {
    id: 'sms',
    label: 'SMS API võti',
    envVar: 'SMS_API_KEY',
    description: 'SMS-teavituste saatmise võti (teavitusteenus on arenduses).',
    probe: { kind: 'presence', envVars: ['SMS_API_KEY'] },
  },
  {
    id: 'map',
    label: 'Kaardiserver (Leaflet)',
    envVar: 'MAP_TILE_URL',
    description:
      'Oksjonilootide kaardikihi tileserver; tühi väärtus kasutab OpenStreetMapi vaikeseadet.',
    probe: {
      kind: 'http',
      envVars: [],
      url: 'https://tile.openstreetmap.org/',
      urlEnvVar: 'MAP_TILE_URL',
    },
  },
]

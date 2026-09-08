/**
 * Env-backed integration key cards (demo 13-settings "Integratsioonid").
 * Values live only in environment variables: the UI shows the variable
 * name plus a configured/unconfigured dot, and the audited
 * settings.key_reveal action is the single return path for raw values.
 */
export interface IntegrationKeyDefinition {
  id: string
  label: string
  envVar: string
  description: string
}

export const integrationKeyDefinitions: readonly IntegrationKeyDefinition[] = [
  {
    id: 'eideasy',
    label: 'eID Easy API võti',
    envVar: 'EIDEASY_SECRET',
    description: 'eID (Smart-ID, Mobile-ID, ID-kaart) autentimispäringute võti.',
  },
  {
    id: 'cloudflare-email',
    label: 'Cloudflare Email API võti',
    envVar: 'CLOUDFLARE_EMAIL_TOKEN',
    description: 'Süsteemi e-kirjade saatmise võti (peamine transpordikanal).',
  },
  {
    id: 'smtp',
    label: 'SMTP salasõna',
    envVar: 'SMTP_PASS',
    description: 'Kohaliku SMTP varulülituse salasõna (nt Mailpit arenduses).',
  },
]

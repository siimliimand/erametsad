import type { ContractTemplateType } from '@/lib/data/schema'

/**
 * Placeholder catalogue for contract templates (docs/design/admin/08,
 * "Placeholder catalogue" + the tokens lib/contracts/service.ts injects at
 * generation time: auctionTitle, auctionId, date).
 */
export interface PlaceholderGroup {
  label: string
  tokens: readonly string[]
}

export const PLACEHOLDER_GROUPS: readonly PlaceholderGroup[] = [
  {
    label: 'Pakkuja',
    tokens: [
      'bidder.name',
      'bidder.isikukood',
      'bidder.registrikood',
      'bidder.address',
      'bidder.email',
      'bidder.phone',
      'bidder.companyName',
    ],
  },
  {
    label: 'Oksjon',
    tokens: [
      'lot.id',
      'lot.name',
      'lot.objectType',
      'lot.county',
      'lot.parish',
      'lot.address',
      'lot.area',
      'lot.volume',
      'lot.cadastres',
      'lot.registryNumbers',
      'lot.forestNotifications',
      'lot.loggingDeadline',
      'lot.removalDeadline',
      'lot.minBid',
      'lot.finalPrice',
      'lot.loggingTypes',
      'lot.compartments',
    ],
  },
  {
    label: 'Pakett',
    tokens: ['lot.propertyCount', 'lot.packageDescription', 'lot.packageTable'],
  },
  {
    label: 'Tehing',
    tokens: [
      'bid.amount',
      'bid.submittedAt',
      'auction.endedAt',
      'fee.percent',
      'fee.amountVatExcl',
      'fee.amountVat',
      'fee.total',
    ],
  },
  {
    label: 'Osapooled',
    tokens: [
      'company.legalName',
      'company.regCode',
      'company.address',
      'company.kmkr',
      'signer.name',
      'signer.idCode',
      'date.today',
    ],
  },
  {
    label: 'Üldine',
    tokens: ['auctionTitle', 'auctionId', 'date'],
  },
]

const KNOWN_TOKENS: ReadonlySet<string> = new Set(
  PLACEHOLDER_GROUPS.flatMap((group) => group.tokens),
)

/**
 * Required tokens per template type (docs/design/admin/08 validation rules).
 * Each inner list is an alternatives group: at least one member must occur.
 */
const REQUIRED_TOKEN_GROUPS: Record<ContractTemplateType, readonly (readonly string[])[]> = {
  auction: [
    ['bidder.name'],
    ['bidder.isikukood', 'bidder.registrikood'],
    ['lot.id'],
    ['lot.finalPrice', 'bid.amount'],
    ['fee.total'],
  ],
  framework: [['bidder.name'], ['company.legalName'], ['date.today']],
}

export type TemplateTokenValidation =
  | { ok: true }
  | { ok: false; unknown: string[]; missing: readonly (readonly string[])[] }

export function isKnownToken(token: string): boolean {
  return KNOWN_TOKENS.has(token)
}

export function validateTemplateTokens(
  type: ContractTemplateType,
  tokens: readonly string[],
): TemplateTokenValidation {
  const unknown = tokens.filter((token) => !KNOWN_TOKENS.has(token))
  const present = new Set(tokens)
  const missing = REQUIRED_TOKEN_GROUPS[type].filter(
    (alternatives) => !alternatives.some((token) => present.has(token)),
  )
  if (unknown.length === 0 && missing.length === 0) {
    return { ok: true }
  }
  return { ok: false, unknown, missing }
}

/** Estonian user-facing message for a failed validation; null when valid. */
export function buildValidationMessage(validation: TemplateTokenValidation): string | null {
  if (validation.ok) return null
  const parts: string[] = []
  if (validation.unknown.length > 0) {
    const listed = validation.unknown.map((token) => `{{${token}}}`).join(', ')
    parts.push(`Tundmatud kohatäited: ${listed}. Kasuta ainult kataloogi kohatäiteid.`)
  }
  if (validation.missing.length > 0) {
    const listed = validation.missing
      .map((alternatives) => alternatives.map((token) => `{{${token}}}`).join(' või '))
      .join('; ')
    parts.push(`Nõutud kohatäited puuduvad: ${listed}.`)
  }
  return parts.join(' ')
}

const TOKEN_PATTERN = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g

/** Ordered unique `{{token}}` list found in a template source. */
export function extractTemplateTokens(source: string): string[] {
  const tokens: string[] = []
  for (const match of source.matchAll(TOKEN_PATTERN)) {
    const token = match[1]
    if (token !== undefined && !tokens.includes(token)) {
      tokens.push(token)
    }
  }
  return tokens
}

/**
 * Fictional fixture data for the test-render drawer (docs/design/admin/08:
 * "Test Testov / Tamm OÜ 14309277 / lot #1 Testmets, 61 000 €").
 */
export function templateFixtureData(): Record<string, string> {
  const today = new Date().toLocaleDateString('et-EE')
  const data: Record<string, string> = {}
  for (const group of PLACEHOLDER_GROUPS) {
    for (const token of group.tokens) {
      data[token] = `[${token}]`
    }
  }
  Object.assign(data, {
    'bidder.name': 'Test Testov',
    'bidder.isikukood': '39101010000',
    'bidder.registrikood': '14309277',
    'bidder.address': 'Testi tn 1, 10111 Tallinn',
    'bidder.email': 'test.testov@test.ee',
    'bidder.phone': '+372 5555 0001',
    'bidder.companyName': 'Tamm OÜ',
    'lot.id': '1',
    'lot.name': 'Testmets',
    'lot.objectType': 'Raieõigus',
    'lot.county': 'Harju maakond',
    'lot.parish': 'Kuusalu vald',
    'lot.address': 'Testi küla',
    'lot.area': '12,5 ha',
    'lot.volume': '1 850 m³',
    'lot.cadastres': '12345:678:9012',
    'lot.registryNumbers': 'EE12345678',
    'lot.forestNotifications': 'RK-2026-001',
    'lot.loggingDeadline': '31.12.2026',
    'lot.removalDeadline': '31.03.2027',
    'lot.minBid': '40 000 €',
    'lot.finalPrice': '61 000 €',
    'lot.loggingTypes': 'Sanitaarraie',
    'lot.compartments': '071',
    'lot.propertyCount': '1',
    'lot.packageDescription': 'Üks raieõiguse pakett',
    'lot.packageTable': '(paketi tabel)',
    'bid.amount': '61 000 €',
    'bid.submittedAt': `01.09.2026 12:00`,
    'auction.endedAt': '01.09.2026 12:00',
    'fee.percent': '3 %',
    'fee.amountVatExcl': '1 830 €',
    'fee.amountVat': '2 236 €',
    'fee.total': '63 236 €',
    'company.legalName': 'Tamm OÜ',
    'company.regCode': '14309277',
    'company.address': 'Testi tn 1, 10111 Tallinn',
    'company.kmkr': 'EE102119480',
    'signer.name': 'Mari Mets',
    'signer.idCode': '48001010000',
    'date.today': today,
    auctionTitle: 'Testioksjon #1',
    auctionId: '1',
    date: today,
  })
  return data
}

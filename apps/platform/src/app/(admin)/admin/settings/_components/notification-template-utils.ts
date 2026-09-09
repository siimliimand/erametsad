import type { TemplateChannel } from '@/lib/data/schema'

/**
 * Pure helpers shared by the Teavitused section UI and its server actions.
 * The event and variable lists mirror the payloads that
 * notifications/service.ts already renders, so inserted placeholders use
 * names the dispatcher actually substitutes.
 */

export interface TemplateEventDefinition {
  event: string
  label: string
}

// DomainEventType values (lib/notifications/event-bus.ts) with Estonian
// labels for the template list and the editor's event selector.
export const templateEvents: readonly TemplateEventDefinition[] = [
  { event: 'auction.published', label: 'Oksjon avaldatud' },
  { event: 'bid.created', label: 'Pakkumus registreeritud' },
  { event: 'outbid', label: 'Pakkumus üle pakutud' },
  { event: 'auction.won', label: 'Oksjon võidetud' },
  { event: 'auction.ended', label: 'Oksjon lõppenud' },
  { event: 'auction.sold', label: 'Oksjon leidis ostja' },
  { event: 'contract.ready', label: 'Leping allkirjastamiseks valmis' },
  { event: 'bid.approved', label: 'Pakkumus kinnitatud' },
  { event: 'bid.rejected', label: 'Pakkumus tagasi lükatud' },
]

export function templateEventLabel(event: string): string {
  return templateEvents.find((definition) => definition.event === event)?.label ?? event
}

export const templateChannelLabels: Record<TemplateChannel, string> = {
  email: 'E-post',
  sms: 'SMS',
}

export interface TemplateVariableDefinition {
  name: string
  label: string
  /** Value substituted on a test send. */
  sample: string
}

// Payload keys read by getTemplate() in notifications/service.ts.
export const templateVariables: readonly TemplateVariableDefinition[] = [
  { name: 'auctionTitle', label: 'Oksjoni pealkiri', sample: 'Raieõigus, Võru maakond' },
  { name: 'amount', label: 'Pakkumuse summa (EUR)', sample: '1500' },
  { name: 'currentBid', label: 'Praegune pakkumus (EUR)', sample: '1500' },
  { name: 'winningBid', label: 'Võidupakkumus (EUR)', sample: '2000' },
  { name: 'finalPrice', label: 'Lõpptulemus (EUR)', sample: '2000' },
  { name: 'feeEstimateEur', label: 'Vahendustasu hinnang (EUR)', sample: '60.00' },
  { name: 'reason', label: 'Põhjus', sample: 'puudulikud dokumendid' },
]

const VARIABLE_TOKEN = /\{\{([a-zA-Z]+)\}\}/g

export interface SmsSegmentInfo {
  chars: number
  segments: number
}

/**
 * GSM-7 heuristic (160 chars per single segment, 153 per concatenated
 * segment). Deliberately ignores the UDH/encoding edge cases; it is a
 * planning aid for the editor, not a billing calculation.
 */
export function smsSegmentInfo(text: string): SmsSegmentInfo {
  const chars = Array.from(text).length
  if (chars === 0) return { chars: 0, segments: 0 }
  if (chars <= 160) return { chars, segments: 1 }
  return { chars, segments: Math.ceil(chars / 153) }
}

/**
 * Inserts a `{{name}}` placeholder at the cursor position and returns the
 * new text plus the cursor position after the token, so the editor can put
 * the caret back. A cursor outside the text clamps to the ends.
 */
export function insertVariableAtCursor(
  text: string,
  cursor: number,
  name: string,
): { text: string; cursor: number } {
  const token = `{{${name}}}`
  const at = Math.max(0, Math.min(cursor, text.length))
  return {
    text: text.slice(0, at) + token + text.slice(at),
    cursor: at + token.length,
  }
}

/**
 * Replaces every `{{name}}` token with the value from `values`; unknown
 * tokens stay untouched so a partially filled sample keeps visible.
 */
export function renderTemplate(text: string, values: Record<string, string>): string {
  return text.replace(VARIABLE_TOKEN, (match, name: string) =>
    typeof values[name] === 'string' ? values[name] : match,
  )
}

/**
 * Two-column before/after JSON diff for audit entries (design D5). Pure
 * helpers are exported for tests; the component is a server component with
 * no client JS.
 */

const SECRET_KEY_FRAGMENTS = [
  'secret',
  'token',
  'password',
  'isikukood',
  'reserve',
  'hashed',
  'authtag',
] as const

export const MASKED_VALUE = '<salajane>'

/**
 * Key-based masking, never value guessing. A key is secret when its
 * lowercase form contains one of the secret fragments, or when "iv" appears
 * as a whole segment (camelCase, kebab or snake boundary). Segment matching
 * for "iv" avoids false positives like "givenName" or "activity".
 */
export function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase()
  // Separators are stripped before fragment matching so kebab/snake forms
  // such as "auth_tag" still match "authtag".
  const normalized = lower.replace(/[^a-z0-9]+/g, '')
  if (SECRET_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))) {
    return true
  }
  return key
    .split(/(?<=[a-z0-9])(?=[A-Z])|[^A-Za-z0-9]+/)
    .some((segment) => segment.toLowerCase() === 'iv')
}

export function leafKeyOf(path: string): string {
  const segments = path.split('.')
  const last = segments[segments.length - 1]
  return last ?? path
}

function flatten(value: unknown, prefix: string, out: Map<string, unknown>): void {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flatten(child, prefix === '' ? key : `${prefix}.${key}`, out)
    }
    return
  }
  out.set(prefix, value)
}

const VALUE_CAP = 2000

export function formatLeafValue(value: unknown, present: boolean): string | null {
  if (!present) return null
  if (value === undefined || value === null) return ''
  let text: string
  if (typeof value === 'string') {
    text = value
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    text = String(value)
  } else {
    text = JSON.stringify(value)
  }
  return text.length > VALUE_CAP ? `${text.slice(0, VALUE_CAP)}…` : text
}

export type DiffLeafState = 'added' | 'removed' | 'changed' | 'unchanged'

export interface DiffLeafRow {
  path: string
  state: DiffLeafState
  before: string | null
  after: string | null
  masked: boolean
}

/** Recursive leaf compare of the two JSON values, sorted by path. */
export function diffJson(before: unknown, after: unknown): DiffLeafRow[] {
  const beforeMap = new Map<string, unknown>()
  const afterMap = new Map<string, unknown>()
  // A null root means "no snapshot on this side", not a leaf.
  if (before !== null && before !== undefined) flatten(before, '', beforeMap)
  if (after !== null && after !== undefined) flatten(after, '', afterMap)
  const paths = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()])).sort()
  return paths.map((path) => {
    const inBefore = beforeMap.has(path)
    const inAfter = afterMap.has(path)
    const beforeText = formatLeafValue(beforeMap.get(path), inBefore)
    const afterText = formatLeafValue(afterMap.get(path), inAfter)
    const state: DiffLeafState = !inBefore
      ? 'added'
      : !inAfter
        ? 'removed'
        : beforeText === afterText
          ? 'unchanged'
          : 'changed'
    return { path, state, before: beforeText, after: afterText, masked: isSecretKey(leafKeyOf(path)) }
  })
}

const ROW_CLASS: Record<DiffLeafState, string> = {
  added: 'bg-emerald-50',
  removed: 'bg-danger-light',
  changed: 'bg-amber-50',
  unchanged: '',
}

const MARKER: Record<DiffLeafState, { before: string; after: string }> = {
  added: { before: '', after: '+' },
  removed: { before: '−', after: '' },
  changed: { before: '−', after: '+' },
  unchanged: { before: '', after: '' },
}

const SECRET_TOOLTIP = 'Väärtuse muutus logitatud, sisu ei salvestata'

function DiffCell({
  value,
  state,
  masked,
  side,
}: {
  value: string | null
  state: DiffLeafState
  masked: boolean
  side: 'before' | 'after'
}) {
  if (value === null) {
    return <td className="h-8 px-2 align-top text-bodySm text-ink-muted">—</td>
  }
  return (
    <td
      className={`h-8 px-2 align-top font-mono text-bodySm whitespace-pre-wrap break-all ${ROW_CLASS[state]}`}
    >
      <span aria-hidden="true" className="mr-1 font-semibold text-ink-muted">
        {MARKER[state][side]}
      </span>
      {masked ? (
        <em title={SECRET_TOOLTIP} className="font-semibold not-italic text-ink">
          {MASKED_VALUE}
        </em>
      ) : (
        value || <span className="text-ink-muted">(tühi)</span>
      )}
    </td>
  )
}

export function AuditDiff({ before, after }: { before: unknown; after: unknown }) {
  const hasData = !(before === null || before === undefined) || !(after === null || after === undefined)
  const rows = hasData ? diffJson(before ?? null, after ?? null) : []
  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-border bg-bgMist px-md py-sm text-bodySm text-ink-muted">
        Enne/järel andmeid pole sellel kirjel.
      </p>
    )
  }
  const changedCount = rows.filter((row) => row.state !== 'unchanged').length
  const table = (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-bgMist">
            <th scope="col" className="h-9 px-2 text-label font-semibold text-ink-muted">
              Väli
            </th>
            <th scope="col" className="h-9 px-2 text-label font-semibold text-ink-muted">
              Enne
            </th>
            <th scope="col" className="h-9 px-2 text-label font-semibold text-ink-muted">
              Järel
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.path} className="border-b border-border last:border-b-0">
              <td
                className="h-8 max-w-[16rem] px-2 align-top font-mono text-bodySm text-ink-muted"
                title={row.path}
              >
                <span className="block truncate">{row.path}</span>
              </td>
              <DiffCell value={row.before} state={row.state} masked={row.masked} side="before" />
              <DiffCell value={row.after} state={row.state} masked={row.masked} side="after" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
  // Very large diffs collapse to a summary the reader can expand.
  if (rows.length > 12) {
    return (
      <details className="rounded-card border border-border bg-bgPage px-md py-sm">
        <summary className="cursor-pointer text-label font-semibold text-primary">
          Näita JSON-diffi ({String(rows.length)} rida, {String(changedCount)} muudetud)
        </summary>
        <div className="mt-sm">{table}</div>
      </details>
    )
  }
  return table
}

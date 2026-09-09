// Redirects CSV bulk import (task 3.5), following the JSON import patterns
// in ./import-export.ts: parse up front, validate every row, plan
// create/update upserts keyed by `from`, report per-item outcomes. Pure
// functions only; the action owns the database writes and audit entries.

import { validateRedirect } from '../../redirects/_lib/redirect-validation'

import { redirectTypes } from '@/lib/data/schema'
import type { RedirectType } from '@/lib/data/schema'


export const MAX_REDIRECT_IMPORT_ITEMS = 500

/** Minimal RFC-4180-ish row shape the parser produces. */
export interface RedirectCsvRow {
  from: string
  to: string
  type: string
  active: string
}

export interface ParsedRedirectPlan {
  action: 'create' | 'update'
  index: number
  from: string
  to: string
  type: RedirectType
  active: boolean
  existingId: string | null
}

export interface RedirectImportItemResult {
  index: number
  from: string
  to: string
  outcome: 'created' | 'updated' | 'would-create' | 'would-update' | 'invalid' | 'failed'
  reason?: string
}

export interface RedirectImportSummary {
  created: number
  updated: number
  failed: number
}

export interface RedirectImportReport {
  status: 'success' | 'partial' | 'dry-run' | 'error'
  message: string
  dryRun: boolean
  items: RedirectImportItemResult[]
  summary: RedirectImportSummary
}

/** Splits one CSV line on commas, honoring double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i] ?? ''
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}

function normalizeLineEndings(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

/**
 * Parses the redirects CSV: one header row (`from,to,type,active`), then
 * one redirect per line. Extra columns are ignored; quoted fields are
 * supported. Returns an Estonian error message for structural problems.
 */
export function parseRedirectCsv(
  text: string,
): { ok: true; rows: RedirectCsvRow[] } | { ok: false; error: string } {
  const lines = normalizeLineEndings(text).filter(
    (line, index) => line.trim().length > 0 || index === 0,
  )
  if (lines.length === 0 || lines[0]?.trim() === '') {
    return { ok: false, error: 'Fail ei sisalda ühtegi kirjet.' }
  }
  const header = splitCsvLine(lines[0] ?? '').map((field) => field.trim().toLowerCase())
  if (header[0] !== 'from' || header[1] !== 'to') {
    return { ok: false, error: 'CSV peab algama päisega "from,to,type,active".' }
  }
  const rows: RedirectCsvRow[] = []
  for (const line of lines.slice(1)) {
    if (line.trim().length === 0) continue
    const fields = splitCsvLine(line)
    rows.push({
      from: (fields[0] ?? '').trim(),
      to: (fields[1] ?? '').trim(),
      type: (fields[2] ?? '').trim(),
      active: (fields[3] ?? '').trim(),
    })
  }
  if (rows.length === 0) {
    return { ok: false, error: 'Fail ei sisalda ühtegi kirjet.' }
  }
  if (rows.length > MAX_REDIRECT_IMPORT_ITEMS) {
    return {
      ok: false,
      error: `Liiga palju kirjeid (${String(rows.length)}); lubatud on kuni ${String(MAX_REDIRECT_IMPORT_ITEMS)}.`,
    }
  }
  return { ok: true, rows }
}

function displayPath(raw: unknown): string {
  return typeof raw === 'string' && raw.length > 0 ? raw : '(puudub)'
}

/**
 * Validates and plans every parsed row. Upserts by `from`; duplicates
 * inside the file and rows breaking the path rules or the hop cap are
 * reported invalid. The working chain map is updated as rows plan, so
 * chains inside one file count.
 */
export function planRedirectCsvUpserts(
  rows: readonly RedirectCsvRow[],
  existingByFrom: ReadonlyMap<string, string>,
  existingChainMap: ReadonlyMap<string, string>,
): { plans: ParsedRedirectPlan[]; invalid: RedirectImportItemResult[] } {
  const plans: ParsedRedirectPlan[] = []
  const invalid: RedirectImportItemResult[] = []
  const chainMap = new Map(existingChainMap)
  const plannedByFrom = new Map<string, ParsedRedirectPlan>()

  rows.forEach((row, position) => {
    const index = position + 1
    const fail = (reason: string): void => {
      invalid.push({
        index,
        from: displayPath(row.from),
        to: displayPath(row.to),
        outcome: 'invalid',
        reason,
      })
    }

    if (row.from.length === 0) {
      fail('Algustee on kohustuslik.')
      return
    }
    if (row.to.length === 0) {
      fail('Sihttee on kohustuslik.')
      return
    }
    const type = (redirectTypes as readonly string[]).includes(row.type)
      ? (row.type as RedirectType)
      : '301'
    const active = row.active.toLowerCase() !== 'ei' && row.active !== 'false' && row.active !== '0'

    // Edited rows drop their old mapping from the working chain map before
    // validation, mirroring the single-save action.
    const workingMap = new Map(chainMap)
    const existingId = existingByFrom.get(row.from)
    workingMap.delete(row.from)
    const validationError = validateRedirect(row.from, row.to, workingMap)
    if (validationError) {
      fail(validationError)
      return
    }
    const duplicate = plannedByFrom.get(row.from)
    if (duplicate) {
      fail(`Rida ${String(duplicate.index)} kasutab sama algusteega juba.`)
      return
    }

    const plan: ParsedRedirectPlan = {
      action: existingId ? 'update' : 'create',
      index,
      from: row.from,
      to: row.to,
      type,
      active,
      existingId: existingId ?? null,
    }
    plans.push(plan)
    plannedByFrom.set(row.from, plan)
    chainMap.set(row.from, row.to)
  })

  return { plans, invalid }
}

export function summarizeRedirectItems(
  items: readonly RedirectImportItemResult[],
): RedirectImportSummary {
  let created = 0
  let updated = 0
  let failed = 0
  for (const item of items) {
    if (item.outcome === 'created' || item.outcome === 'would-create') {
      created += 1
    } else if (item.outcome === 'updated' || item.outcome === 'would-update') {
      updated += 1
    } else {
      failed += 1
    }
  }
  return { created, updated, failed }
}

export const sampleRedirectsCsv = [
  'from,to,type,active',
  '/vana-leht,/uus-leht,301,jah',
  '/kampaania-2025,/teenused,302,jah',
].join('\n')

'use client'

import { Fragment } from 'react'

import { DataTable, type Column } from '@erametsad/ui'

export interface DossierRow {
  label: string
  value: string
  [key: string]: string
}

const columns: Column<DossierRow>[] = [
  {
    key: 'label',
    label: 'Nimi',
    sortable: false,
    width: '40%',
    render: (row) => <span className="font-semibold text-inkMuted">{row.label}</span>,
  },
  {
    key: 'value',
    label: 'Väärtus',
    sortable: false,
    render: (row) =>
      row.label === 'Puuliigid' ? (
        <SpeciesListCell value={row.value} />
      ) : (
        <span className="whitespace-normal text-ink">{row.value}</span>
      ),
  },
]

export function DossierTable({ rows }: { rows: DossierRow[] }) {
  if (rows.length === 0) return null
  return (
    <DataTable<DossierRow>
      columns={columns}
      data={rows}
      sortable={false}
      className="rounded-card border border-border bg-bgPage px-sm py-xs"
    />
  )
}

// Seed and migrated package rows are free-form JSON; several key spellings
// map to the same Estonian column, matching the tolerant approach of
// packageTotals in lib/auction/queries.ts.
const PACKAGE_KEYS: readonly (readonly [string, readonly string[]])[] = [
  ['Nr', ['nr', 'row', 'no', 'number']],
  ['Kvartal', ['kvartal', 'quarter', 'compartment']],
  ['Pindala (ha)', ['area', 'ha', 'areaha', 'area_ha', 'pindala']],
  ['Maht (m³)', ['volume', 'm3', 'volumem3', 'volume_m3', 'maht']],
  ['Puuliik', ['species', 'puuliik']],
]

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9äöüõ]/g, '')
}

// Code set is the shared TreeSpecies taxonomy in packages/types; keys are
// the lowercase 2-letter codes stored in package rows and dossier values.
// PP, LV, TP, KE, SM, KR have no name established in the repo, so they
// pass through verbatim without a tooltip.
const SPECIES_FULL_NAMES: Readonly<Record<string, string>> = {
  ma: 'Mänd',
  ku: 'Kuusk',
  ks: 'Kask',
  ha: 'Haab',
  hb: 'Haab',
  hl: 'Hall lepp',
  lm: 'Lehis',
  ta: 'Tamm',
  sa: 'Sanglepp',
  ja: 'Jaapani lehis',
  pn: 'Pärn',
  va: 'Vaher',
  tk: 'Toomingas',
  ph: 'Pihlakas',
  re: 'Remmelgas',
  nu: 'Nulud',
  ts: 'Harilik tsuuga',
  lh: 'Läänemänd',
  kp: 'Kanada pappel',
}

function isSpeciesColumn(keys: readonly string[]): boolean {
  return keys.some((key) => {
    const normalized = normalizeKey(key)
    return normalized === 'species' || normalized === 'puuliik'
  })
}

/** Species cell content: short label as-is, full name as the native tooltip. */
function SpeciesCell({ value, species }: { value: string; species: boolean }) {
  if (!species) return <span className="whitespace-normal">{value}</span>
  const trimmed = value.trim()
  const fullName = SPECIES_FULL_NAMES[trimmed.toLowerCase()]
  if (fullName === undefined || fullName.toLowerCase() === trimmed.toLowerCase()) {
    return <span className="whitespace-normal">{value}</span>
  }
  return (
    <span className="whitespace-normal" title={fullName}>
      {value}
    </span>
  )
}

/** Dossier species row: page.tsx passes codes comma-joined, so split and
 * tooltip each token instead of rendering the joined text bare. */
function SpeciesListCell({ value }: { value: string }) {
  const tokens = value
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token !== '')
  return (
    <span className="whitespace-normal text-ink">
      {tokens.map((token, index) => (
        <Fragment key={`${token}-${String(index)}`}>
          {index > 0 ? ', ' : ''}
          <SpeciesCell value={token} species />
        </Fragment>
      ))}
    </span>
  )
}

function cellOf(row: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value: unknown = row[key]
    if (typeof value === 'string' && value.trim() !== '') return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (typeof value === 'boolean') return value ? 'Jah' : 'Ei'
  }
  return null
}

interface PackageColumn {
  label: string
  keys: readonly string[]
}

function buildPackageColumns(rows: Record<string, unknown>[]): PackageColumn[] {
  const present = new Map<string, string[]>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const normalized = normalizeKey(key)
      if (normalized !== '') {
        const known = PACKAGE_KEYS.find(([, keys]) => keys.includes(normalized))
        const canonical = known ? known[0] : key
        const aliases = present.get(canonical) ?? []
        aliases.push(key)
        present.set(canonical, aliases)
      }
    }
  }
  return PACKAGE_KEYS.filter(([label]) => present.has(label)).map(([label, keys]) => {
    const rowKeys = present.get(label) ?? []
    const covered = new Set(keys.map((key) => normalizeKey(key)))
    return {
      label,
      keys: [...keys, ...rowKeys.filter((key) => !covered.has(normalizeKey(key)))],
    }
  })
}

function PackageTable({
  header,
  columns,
  rows,
}: {
  header: string | null
  columns: PackageColumn[]
  rows: Record<string, unknown>[]
}) {
  if (columns.length === 0 || rows.length === 0) return null

  const tableColumns: Column<Record<string, unknown>>[] = columns.map((column) => ({
    key: column.label,
    label: column.label,
    sortable: false,
    render: (row) => {
      const value = cellOf(row, column.keys)
      if (value === null) return null
      return <SpeciesCell value={value} species={isSpeciesColumn(column.keys)} />
    },
  }))

  return (
    <div>
      {header && <h3 className="mb-sm font-heading text-h4 text-ink">{header}</h3>}
      <DataTable<Record<string, unknown>>
        columns={tableColumns}
        data={rows}
        sortable={false}
        className="rounded-card border border-border bg-bgPage px-sm py-xs"
      />
    </div>
  )
}

export function PackageSection({
  header,
  columns,
  rows,
}: {
  header: string | null
  columns: string[]
  rows: unknown[]
}) {
  const objectRows = rows.filter(
    (row): row is Record<string, unknown> => typeof row === 'object' && row !== null,
  )
  if (objectRows.length === 0) return null

  const derived = buildPackageColumns(objectRows)
  // Stored column labels only shape the header when they match what the
  // rows actually contain; otherwise the derived columns win.
  const labeled =
    columns.length === derived.length
      ? derived.map((column, index) => {
          const stored = columns[index]
          return stored !== undefined ? { ...column, label: stored } : column
        })
      : derived

  return (
    <PackageTable
      header={header}
      columns={labeled}
      rows={objectRows}
    />
  )
}

import { DataTable, type Column } from '@eametsad/ui'

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
    render: (row) => <span className="whitespace-normal text-ink">{row.value}</span>,
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

// Same code set as SPECIES_CODE_NAMES in lib/auction/queries.ts (kept
// module-private there and server-only, so this client-safe copy maps the
// short codes to the full Estonian species names shown in the tooltip).
const SPECIES_FULL_NAMES: Readonly<Record<string, string>> = {
  ma: 'Mänd',
  ku: 'Kuusk',
  ks: 'Kask',
  ha: 'Haab',
  sa: 'Sanglepp',
  ta: 'Tamm',
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

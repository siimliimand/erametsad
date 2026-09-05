'use client'

import { useId, useState } from 'react'

import {
  emptyPackageRow,
  packageRowSums,
  parseDecimal,
  parseInteger,
  parsePackageRowsCsv,
} from './wizard-model'
import type { PackageRowState, WizardStepContext } from './wizard-model'
import { FieldError, FieldHint, FieldLabel, WarningNote } from './wizard-ui'
import { inputClass, secondaryButtonClass } from '../../../_components/FormField'
import { CADASTRE_PATTERN } from '../_lib/auction-schema'

/**
 * Step 6 Pakett (docs/design/admin/03 step 6): property count, package
 * header and the package table row editor with footer auto-sums and CSV
 * paste-import. The step renders only for package lots (steps.tsx filter);
 * the schema's pakett gates are the final arbiter.
 */

const SUM_EPSILON = 0.0001

function rowError(row: PackageRowState): string | null {
  const cadastre = row.cadastre.trim()
  if (cadastre !== '' && !CADASTRE_PATTERN.test(cadastre)) {
    return 'Katastritunnuse vorming peab olema NNNNN:NNN:NNNN.'
  }
  const registry = row.registryNumber.trim()
  if (registry !== '' && !/^\d+$/.test(registry)) {
    return 'Kinnistu registri number peab olema numbriline.'
  }
  const area = parseDecimal(row.areaHa)
  if (row.areaHa.trim() !== '' && (area === undefined || area <= 0)) {
    return 'Pindala peab olema positiivne.'
  }
  const minBid = parseDecimal(row.minBidEur)
  if (row.minBidEur.trim() !== '' && (minBid === undefined || minBid < 0)) {
    return 'Alghind ei tohi olla negatiivne.'
  }
  return null
}

const packageRowErrorKey = (index: number, field: string): string =>
  `packageRows.${String(index)}.${field}`

export function StepPakett({ state, patch, errors }: WizardStepContext) {
  const id = useId()
  const [pasting, setPasting] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const rows = state.packageRows
  const sums = packageRowSums(rows)
  const lotArea = parseDecimal(state.areaHa)
  const lotAreaLabel = lotArea === undefined ? '' : lotArea.toLocaleString('et-EE')

  const rowCountMismatch =
    state.propertyCount !== null && rows.length > 0 && rows.length !== state.propertyCount
  const areaMismatch =
    lotArea !== undefined &&
    rows.some((row) => parseDecimal(row.areaHa) !== undefined) &&
    Math.abs(sums.areaHa - lotArea) > SUM_EPSILON

  function patchRows(next: PackageRowState[]): void {
    patch({ packageRows: next })
  }

  function updateRow(index: number, update: Partial<PackageRowState>): void {
    patchRows(rows.map((row, i) => (i === index ? { ...row, ...update } : row)))
  }

  function moveRow(index: number, delta: -1 | 1): void {
    const target = index + delta
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    const [moved] = next.splice(index, 1)
    if (moved === undefined) return
    next.splice(target, 0, moved)
    patchRows(next)
  }

  function applyPaste(): void {
    const parsed = parsePackageRowsCsv(pasteText)
    if (parsed.length > 0) {
      patchRows([...rows.filter((row) => !isRowEmptyLocal(row)), ...parsed])
    }
    setPasteText('')
    setPasting(false)
  }

  function isRowEmptyLocal(row: PackageRowState): boolean {
    return (
      row.cadastre.trim() === '' &&
      row.registryNumber.trim() === '' &&
      row.county.trim() === '' &&
      row.areaHa.trim() === '' &&
      row.minBidEur.trim() === ''
    )
  }

  const columns: readonly { key: keyof PackageRowState; label: string; type?: string }[] = [
    { key: 'cadastre', label: 'Katastritunnus' },
    { key: 'registryNumber', label: 'Kinnistu nr' },
    { key: 'county', label: 'Maakond' },
    { key: 'areaHa', label: 'Pindala ha', type: 'number' },
    { key: 'minBidEur', label: 'Alghind €', type: 'number' },
  ]

  return (
    <div className="flex flex-col gap-sm">
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor={`${id}-propertyCount`} required>
            Kinnistute arv
          </FieldLabel>
          <input
            id={`${id}-propertyCount`}
            type="number"
            min={2}
            step={1}
            value={state.propertyCount === null ? '' : String(state.propertyCount)}
            onChange={(event) => {
              patch({ propertyCount: parseInteger(event.target.value) ?? null })
            }}
            className={`${inputClass} max-w-32 ${errors.propertyCount !== undefined ? 'border-danger' : ''}`}
          />
          <FieldHint>Vähemalt kaks kinnistut.</FieldHint>
          <FieldError message={errors.propertyCount} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={`${id}-packageHeader`}>Paketi kirjeldus</FieldLabel>
        <textarea
          id={`${id}-packageHeader`}
          rows={5}
          value={state.packageHeader}
          onChange={(event) => {
            patch({ packageHeader: event.target.value })
          }}
          className={`${inputClass} h-auto py-2 ${errors.packageHeader !== undefined ? 'border-danger' : ''}`}
        />
        <FieldHint> Kuvatakse portaalis paketi tabeli juures.</FieldHint>
        <FieldError message={errors.packageHeader} />
      </div>

      <div className="flex flex-col gap-xs">
        <FieldLabel htmlFor={`${id}-row-0-cadastre`} required>
          Paketi tabel
        </FieldLabel>
        <FieldHint>
          Read järjestatakse nagu tabelis; summad arvutatakse allosas automaatselt.
        </FieldHint>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-bodySm">
            <thead>
              <tr>
                <th scope="col" className="w-8 px-1 py-1 text-left font-semibold text-inkMuted">
                  #
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="px-1 py-1 text-left font-semibold text-inkMuted"
                  >
                    {column.label}
                  </th>
                ))}
                <th scope="col" className="px-1 py-1">
                  <span className="sr-only">Rea tegevused</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const inlineError = rowError(row)
                return (
                  <tr key={String(index)} className="align-top">
                    <td className="px-1 py-1 text-inkMuted">{String(index + 1)}</td>
                    {columns.map((column) => {
                      const errorKey = packageRowErrorKey(index, column.key)
                      const invalid = errors[errorKey] !== undefined || inlineError !== null
                      return (
                        <td key={column.key} className="px-1 py-1">
                          <input
                            id={index === 0 && column.key === 'cadastre' ? `${id}-row-0-cadastre` : undefined}
                            type={column.type ?? 'text'}
                            value={row[column.key]}
                            onChange={(event) => {
                              updateRow(index, { [column.key]: event.target.value })
                            }}
                            aria-label={`${column.label}, rida ${String(index + 1)}`}
                            className={`${inputClass} min-w-28 ${invalid ? 'border-danger' : ''}`}
                          />
                          {column.key === 'cadastre' && inlineError !== null ? (
                            <p className="mt-0.5 text-bodySm font-medium text-danger">
                              {inlineError}
                            </p>
                          ) : null}
                          {errors[errorKey] !== undefined ? (
                            <p className="mt-0.5 text-bodySm font-medium text-danger">
                              {errors[errorKey]}
                            </p>
                          ) : null}
                        </td>
                      )
                    })}
                    <td className="px-1 py-1">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => {
                            moveRow(index, -1)
                          }}
                          aria-label={`Tõsta rida ${String(index + 1)} üles`}
                          className="rounded-button border border-border px-1.5 py-1 text-label text-ink disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={index === rows.length - 1}
                          onClick={() => {
                            moveRow(index, 1)
                          }}
                          aria-label={`Tõsta rida ${String(index + 1)} alla`}
                          className="rounded-button border border-border px-1.5 py-1 text-label text-ink disabled:opacity-40"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            patchRows(rows.filter((_, i) => i !== index))
                          }}
                          aria-label={`Eemalda rida ${String(index + 1)}`}
                          className="whitespace-nowrap rounded-button px-1.5 py-1 text-label text-inkMuted transition-colors duration-hover ease-hover hover:text-danger"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t border-border font-semibold text-ink">
                <td className="px-1 py-1" />
                <td className="px-1 py-1" colSpan={2}>
                  Summa
                </td>
                <td className="px-1 py-1">{sums.areaHa.toLocaleString('et-EE')}</td>
                <td className="px-1 py-1">{sums.minBidEur.toLocaleString('et-EE')} €</td>
                <td className="px-1 py-1" />
              </tr>
            </tbody>
          </table>
        </div>
        {rowCountMismatch ? (
          <WarningNote>
            Ridade arv ({String(rows.length)}) ei võrdu kinnistute arvuga (
            {String(state.propertyCount)}).
          </WarningNote>
        ) : null}
        {areaMismatch ? (
          <WarningNote>
            Ridade pindalade summa ({sums.areaHa.toLocaleString('et-EE')} ha) erineb sammu 3
            pindalast ({lotAreaLabel} ha).
          </WarningNote>
        ) : null}
        <div className="flex items-center gap-xs">
          <button
            type="button"
            onClick={() => {
              patchRows([...rows, emptyPackageRow()])
            }}
            className={secondaryButtonClass}
          >
            Lisa rida
          </button>
          <button
            type="button"
            onClick={() => {
              setPasting((current) => !current)
            }}
            className="text-label font-semibold text-primary underline-offset-2 hover:underline"
          >
            {pasting ? 'Sulge kleebimine' : 'Kleebi tabel'}
          </button>
        </div>
        {pasting ? (
          <div className="flex flex-col gap-xs rounded-card border border-border bg-bgPage p-sm">
            <textarea
              value={pasteText}
              rows={4}
              placeholder="Üks rida rea kohta: katastritunnus; kinnistu nr; maakond; pindala; alghind — eraldajaks tab, semikoolon või koma"
              onChange={(event) => {
                setPasteText(event.target.value)
              }}
              className={`${inputClass} h-auto py-2 font-mono`}
            />
            <button type="button" onClick={applyPaste} className={secondaryButtonClass}>
              Lisa read
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

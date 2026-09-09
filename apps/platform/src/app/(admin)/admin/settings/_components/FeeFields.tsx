'use client'

import { useState } from 'react'

import { FormField } from '../../../_components/FormField'
import { feeSampleCents, settingsBounds } from '../../content/_components/settings-audit'

// The live sample (spec: "live sample calculation") quotes the fee for a
// 100 € winning bid.
const SAMPLE_BID_CENTS = 10_000

function parseNumericInput(raw: string): number | null {
  const value = Number(raw.trim().replace(',', '.'))
  return raw.trim().length > 0 && Number.isFinite(value) ? value : null
}

function formatEur(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`
}

/**
 * Teenustasud fields (demo 13-settings). Fee percentage and minimum fee are
 * controlled so the sample line recomputes while the operator types; the
 * quick-auction override and VAT stay uncontrolled form fields.
 */
export function FeeFields({
  feePercent,
  vatPercent,
  quickAuctionFeePercent,
  minimumFeeCents,
}: {
  feePercent: number
  vatPercent: number
  quickAuctionFeePercent: number | null
  minimumFeeCents: number
}) {
  const quickFeeBounds = settingsBounds.quickAuctionFeePercent
  const [feePercentText, setFeePercentText] = useState(String(feePercent))
  const [minimumFeeText, setMinimumFeeText] = useState((minimumFeeCents / 100).toFixed(2))

  const feePct = parseNumericInput(feePercentText)
  const minimumEur = parseNumericInput(minimumFeeText)
  const sampleCents = feeSampleCents(
    SAMPLE_BID_CENTS,
    feePct ?? settingsBounds.feePercent.default,
    Math.max(0, Math.round((minimumEur ?? 0) * 100)),
  )
  const percentOnlyCents = Math.round((SAMPLE_BID_CENTS * (feePct ?? 0)) / 100)
  const minimumApplies = minimumEur !== null && sampleCents > percentOnlyCents

  return (
    <div className="flex flex-col gap-sm">
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormField
          label="Vahendustasu (%)"
          name="feePercent"
          type="number"
          min={String(settingsBounds.feePercent.min)}
          max={String(settingsBounds.feePercent.max)}
          step="1"
          required
          hint="Vahemikus 0–10%. Kehtib ainult uutele oksjonidele."
          value={feePercentText}
          onChange={(event) => {
            setFeePercentText(event.target.value)
          }}
        />
        <FormField
          label="Käibemaks (%)"
          name="vatPercent"
          type="number"
          min="0"
          max="100"
          step="1"
          required
          defaultValue={vatPercent}
        />
        <FormField
          label="Kiiroksjoni teenustasu (%)"
          name="quickAuctionFeePercent"
          type="number"
          min={String(quickFeeBounds.min)}
          max={String(quickFeeBounds.max)}
          step="1"
          hint="Erisus vaikemäärale; tühi väli kasutab vaikimisi teenustasu."
          defaultValue={quickAuctionFeePercent === null ? '' : String(quickAuctionFeePercent)}
        />
        <FormField
          label="Minimaalne tasu (€)"
          name="minimumFeeEur"
          type="number"
          min="0"
          step="0.01"
          hint="Teenustasu ei saa olla sellest summast madalam. 0 = miinimum puudub."
          value={minimumFeeText}
          onChange={(event) => {
            setMinimumFeeText(event.target.value)
          }}
        />
      </div>
      <p aria-live="polite" className="text-bodySm text-inkMuted">
        Näide: 100 € pakkumise puhul on teenustasu {formatEur(sampleCents)}
        {minimumApplies ? ' (miinimumtasu)' : ''}.
      </p>
    </div>
  )
}

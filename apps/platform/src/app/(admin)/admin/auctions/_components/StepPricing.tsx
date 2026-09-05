'use client'

import { parseDecimal } from './wizard-model'
import type { WizardStepContext } from './wizard-model'
import { FieldError, FieldHint, FieldLabel } from './wizard-ui'
import { inputClass } from '../../../_components/FormField'

const RESERVE_SECRET_HINT = 'Piirhind on salajane — müüja ja avalik vaade seda ei näe.'

export function StepPricing({ state, patch, errors, initial, options }: WizardStepContext) {
  const reserveTouched = state.reserveEur.trim() !== ''
  const showMaskedChip = initial.hasReserve && !state.reserveEditing && !reserveTouched
  const showReentry = initial.hasReserve && state.reserveEditing
  const showConfirmed = initial.hasReserve && !state.reserveEditing && reserveTouched
  const showFreshEntry = !initial.hasReserve

  return (
    <div className="flex flex-col gap-sm">
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="wizard-minBidEur" required>
            Alghind (EUR)
          </FieldLabel>
          <input
            id="wizard-minBidEur"
            type="number"
            min="0"
            step="0.01"
            value={state.minBidEur}
            disabled={initial.mechanicsLocked}
            onChange={(event) => {
              patch({ minBidEur: event.target.value })
            }}
            className={inputClass}
          />
          {state.isQuickAuction ? <FieldHint>Kiiroksjoni alghind on 1 €.</FieldHint> : null}
          <FieldError message={errors.minBidEur} />
        </div>
        {state.auctionType === 'open' ? (
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="wizard-bidStepEur" required>
              Pakkumise samm (EUR)
            </FieldLabel>
            <input
              id="wizard-bidStepEur"
              type="number"
              min="1"
              step="0.01"
              value={state.bidStepEur}
              disabled={initial.mechanicsLocked}
              onChange={(event) => {
                patch({ bidStepEur: event.target.value })
              }}
              className={inputClass}
            />
            <FieldHint>Ainult avatud oksjonil; vähemalt 1 €.</FieldHint>
            <FieldError message={errors.bidStepEur} />
          </div>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-xs rounded-card border border-border p-sm">
        <legend className="px-xs text-label font-semibold text-ink">Piirhind (salajane)</legend>

        {showMaskedChip ? (
          <div className="flex flex-col gap-xs">
            <div className="flex flex-wrap items-center gap-sm">
              <span
                aria-label="Piirhind on salvestatud ja varjatud"
                className="rounded-input border border-border bg-bgMist px-sm py-xs font-mono text-body text-ink"
              >
                ••••• €
              </span>
              <span className="text-bodySm text-inkMuted">salvestatud (varjatud)</span>
              <button
                type="button"
                onClick={() => {
                  patch({ reserveEditing: true })
                }}
                className="text-label font-semibold text-primary underline-offset-2 hover:underline"
              >
                Muuda
              </button>
            </div>
            {state.isQuickAuction ? (
              <p className="text-bodySm font-medium text-info">
                Kiiroksjoni salvestamiseks sisesta piirhind uuesti (salvestatud väärtust ei
                näidata).
              </p>
            ) : (
              <FieldHint>
                Piirhind jääb muutumatuks, kui sa seda uuesti ei sisesta. {RESERVE_SECRET_HINT}
              </FieldHint>
            )}
          </div>
        ) : null}

        {showReentry ? (
          <div className="flex flex-col gap-xs">
            <FieldLabel htmlFor="wizard-reserveEur" required>
              Sisesta piirhind uuesti (EUR)
            </FieldLabel>
            <input
              id="wizard-reserveEur"
              type="number"
              min="0"
              step="0.01"
              value={state.reserveEur}
              onChange={(event) => {
                patch({ reserveEur: event.target.value })
              }}
              className={inputClass}
            />
            <FieldHint>
              Varjatud väärtust ei näidata — sisesta täisväärtus; salvestamisel asendab see vana
              piirhinna.
            </FieldHint>
            <div className="flex items-center gap-xs">
              <button
                type="button"
                onClick={() => {
                  const parsed = parseDecimal(state.reserveEur)
                  if (parsed !== undefined && parsed >= 0) {
                    patch({ reserveEditing: false })
                  }
                }}
                className="h-9 rounded-button bg-primary px-4 text-label font-semibold text-ink-inverse transition-colors duration-hover ease-hover hover:bg-primaryHover"
              >
                Kinnita
              </button>
              <button
                type="button"
                onClick={() => {
                  patch({ reserveEur: '', reserveEditing: false })
                }}
                className="h-9 rounded-button px-4 text-label font-semibold text-inkMuted underline-offset-2 hover:underline"
              >
                Tühista
              </button>
            </div>
          </div>
        ) : null}

        {showConfirmed ? (
          <div className="flex flex-col gap-xs">
            <p className="text-bodySm text-ink">
              Uus piirhind on sisestatud ja asendab salvestamisel varjatud väärtust.
            </p>
            <button
              type="button"
              onClick={() => {
                patch({ reserveEur: '', reserveEditing: false })
              }}
              className="w-fit text-label font-semibold text-inkMuted underline-offset-2 hover:underline"
            >
              Tühista uus väärtus
            </button>
          </div>
        ) : null}

        {showFreshEntry ? (
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="wizard-reserveEur" required={state.isQuickAuction}>
              Piirhind (EUR)
            </FieldLabel>
            <input
              id="wizard-reserveEur"
              type="number"
              min="0"
              step="0.01"
              value={state.reserveEur}
              onChange={(event) => {
                patch({ reserveEur: event.target.value })
              }}
              className={inputClass}
            />
            <FieldHint>{RESERVE_SECRET_HINT}</FieldHint>
          </div>
        ) : null}

        <FieldError message={errors.reservePriceEur} />
      </fieldset>

      {options.canFeeOverride ? (
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="wizard-feeOverridePercent">Teenustasu ülekaal (%)</FieldLabel>
          <input
            id="wizard-feeOverridePercent"
            type="number"
            min="0"
            max="100"
            step="1"
            value={state.feeOverridePercent}
            placeholder={`tühi = globaalne ${String(options.defaultFeePercent)}%`}
            onChange={(event) => {
              patch({ feeOverridePercent: event.target.value })
            }}
            className={`${inputClass} max-w-48`}
          />
          <FieldHint>
            Ainult admin; tühi tähendab globaalset vaikeseadet (
            {String(options.defaultFeePercent)}%).
          </FieldHint>
          <FieldError message={errors.feeOverridePercent} />
        </div>
      ) : null}
    </div>
  )
}

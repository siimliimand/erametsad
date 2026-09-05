'use client'

import { FORCED_SEALED_TOOLTIP, isForcedSealed, quickAuctionPatch } from './wizard-model'
import type { WizardStepContext } from './wizard-model'
import { FieldError, FieldHint, FieldLabel, CheckboxToggle, WarningNote } from './wizard-ui'
import { inputClass } from '../../../_components/FormField'
import { auctionObjectTypeLabels } from '../../../_lib/labels'
import {
  ANTI_SNIPE_MAX_MINUTES,
  ANTI_SNIPE_MIN_MINUTES,
} from '../_lib/auction-schema'

import type { AuctionObjectType } from '@/lib/data/schema'

const objectTypeOptions: readonly AuctionObjectType[] = [
  'raieoigus',
  'kinnistu',
  'kiire',
  'pakett',
]

const timeHint = 'Sisestatud aeg on Euroopa/Tallinna aeg (suvel UTC+3, talvel UTC+2).'

export function StepTypeMechanics({ state, patch, errors, initial, options }: WizardStepContext) {
  const forcedSealed = isForcedSealed(state.objectType)
  const quickLockedByObjectType = state.objectType === 'kiire'
  const locked = initial.mechanicsLocked

  function changeObjectType(objectType: AuctionObjectType): void {
    const base: Partial<typeof state> = { objectType }
    if (isForcedSealed(objectType)) {
      patch({ ...base, auctionType: 'sealed' })
      return
    }
    if (objectType === 'kiire') {
      patch({ ...base, ...quickAuctionPatch(state, true, options.antiSnipeDefaultMinutes) })
      return
    }
    patch(base)
  }

  return (
    <div className="flex flex-col gap-sm">
      {locked ? <WarningNote>Aktiivse oksjoni mehaanikat muuta ei saa.</WarningNote> : null}

      <fieldset className="flex flex-col gap-xs">
        <legend className="text-label font-semibold text-ink">
          Objekti tüüp<span className="text-danger"> *</span>
        </legend>
        <div className="grid grid-cols-2 gap-xs sm:grid-cols-4">
          {objectTypeOptions.map((objectType) => (
            <label
              key={objectType}
              className={`flex cursor-pointer items-center gap-xs rounded-input border px-sm py-xs text-bodySm ${
                state.objectType === objectType
                  ? 'border-primary bg-primaryLight text-ink'
                  : 'border-border bg-bgPage text-ink hover:border-primary'
              } ${locked ? 'cursor-not-allowed opacity-60' : ''}`}
              title={locked ? 'Aktiivse oksjoni mehaanikat muuta ei saa.' : undefined}
            >
              <input
                type="radio"
                name="wizard-objectType"
                checked={state.objectType === objectType}
                disabled={locked}
                onChange={() => {
                  changeObjectType(objectType)
                }}
                className="h-4 w-4 accent-primary"
              />
              {auctionObjectTypeLabels[objectType]}
            </label>
          ))}
        </div>
        <FieldError message={errors.objectType} />
      </fieldset>

      <fieldset className="flex flex-col gap-xs">
        <legend className="text-label font-semibold text-ink">
          Oksjoni tüüp<span className="text-danger"> *</span>
        </legend>
        <div className="flex flex-wrap gap-sm">
          {(['open', 'sealed'] as const).map((type) => {
            const openDisabled = forcedSealed && type === 'open'
            return (
              <label
                key={type}
                title={openDisabled ? FORCED_SEALED_TOOLTIP : undefined}
                className={`flex items-center gap-xs text-bodySm text-ink ${
                  openDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                }`}
              >
                <input
                  type="radio"
                  name="wizard-auctionType"
                  checked={state.auctionType === type}
                  disabled={locked || openDisabled}
                  onChange={() => {
                    patch({ auctionType: type })
                  }}
                  className="h-4 w-4 accent-primary"
                />
                {type === 'open' ? 'Avatud (tõusev)' : `Suletud (pimepakkumine)`}
              </label>
            )
          })}
        </div>
        {forcedSealed ? (
          <FieldHint>
            {auctionObjectTypeLabels[state.objectType]} müüakse ainult pimepakkumisega; avatud
            oksjon on keelatud.
          </FieldHint>
        ) : null}
        <FieldError message={errors.auctionType} />
      </fieldset>

      <div className="flex flex-col gap-xs">
        <CheckboxToggle
          id="wizard-quick"
          label="Kiiroksjon (24–72 h, alghind 1 €, kohustuslik piirhind)"
          checked={state.isQuickAuction}
          disabled={locked || quickLockedByObjectType}
          disabledTitle={
            quickLockedByObjectType
              ? 'Kiire oksjoni tüüp on alati kiiroksjon.'
              : 'Aktiivse oksjoni mehaanikat muuta ei saa.'
          }
          onChange={(checked) => {
            patch(quickAuctionPatch(state, checked, options.antiSnipeDefaultMinutes))
          }}
        />
        <FieldHint>
          Lülitades soovitatakse 48-tunnine kestus ja alghinnaks 1 €; piirhind on salajane.
        </FieldHint>
      </div>

      <div className="flex flex-col gap-xs">
        <CheckboxToggle
          id="wizard-antisnipe"
          label="Automaatselt pikenev lõpp (anti-sniping)"
          checked={state.antiSnipeEnabled}
          onChange={(checked) => {
            patch({ antiSnipeEnabled: checked })
          }}
        />
        {state.antiSnipeEnabled ? (
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="wizard-antisnipe-minutes" required>
              Pikenduse minutid ({String(ANTI_SNIPE_MIN_MINUTES)}–
              {String(ANTI_SNIPE_MAX_MINUTES)})
            </FieldLabel>
            <input
              id="wizard-antisnipe-minutes"
              type="number"
              min={ANTI_SNIPE_MIN_MINUTES}
              max={ANTI_SNIPE_MAX_MINUTES}
              value={state.antiSnipeMinutes}
              onChange={(event) => {
                patch({ antiSnipeMinutes: event.target.value })
              }}
              className={`${inputClass} max-w-32`}
            />
            <FieldHint>
              Viimase N minuti jooksul tehtud pakkumine pikendab lõppu N minuti võrra.
            </FieldHint>
            <FieldError message={errors.antiSnipeMinutes} />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="wizard-startsAt" required>
            Algus (Europe/Tallinn)
          </FieldLabel>
          <input
            id="wizard-startsAt"
            type="datetime-local"
            value={state.startsAt}
            disabled={locked}
            onChange={(event) => {
              patch({ startsAt: event.target.value })
            }}
            className={inputClass}
          />
          <FieldHint>{timeHint}</FieldHint>
          <FieldError message={errors.startsAt} />
        </div>
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="wizard-endsAt" required>
            Lõpp (Europe/Tallinn)
          </FieldLabel>
          <input
            id="wizard-endsAt"
            type="datetime-local"
            value={state.endsAt}
            disabled={locked}
            onChange={(event) => {
              patch({ endsAt: event.target.value })
            }}
            className={inputClass}
          />
          <FieldHint>Kestus 1 tund kuni 90 päeva; kiiroksjonil 24–72 tundi.</FieldHint>
          <FieldError message={errors.endsAt} />
        </div>
      </div>
    </div>
  )
}

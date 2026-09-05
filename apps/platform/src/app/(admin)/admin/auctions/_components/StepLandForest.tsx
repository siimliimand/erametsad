'use client'

import { AuctionRepeater } from './AuctionRepeater'
import { MultiSelectField } from './MultiSelectField'
import { LOGGING_TYPE_OPTIONS, SPECIES_OPTIONS } from './wizard-model'
import type { WizardStepContext } from './wizard-model'
import { FieldError, FieldLabel, WarningNote } from './wizard-ui'
import { inputClass } from '../../../_components/FormField'
import { CADASTRE_PATTERN } from '../_lib/auction-schema'

const CADASTRE_HINT = 'Katastritunnuse vorming peab olema NNNNN:NNN:NNNN (nt 34801:001:0217).'

function validateCadastre(value: string): string | null {
  return CADASTRE_PATTERN.test(value) ? null : 'Vorming peab olema 34801:001:0217'
}

function validateNumeric(value: string): string | null {
  return /^\d+$/.test(value) ? null : 'Peab olema numbriline'
}

function validateNotification(value: string): string | null {
  return /^\d{8,12}$/.test(value) ? null : 'Metsateatise number peab olema 8–12 numbrit'
}

function validateNonEmpty(value: string): string | null {
  return value === '' ? 'Eraldis ei tohi olla tühi' : null
}

export function StepLandForest({ state, patch, errors }: WizardStepContext) {
  const deadlineCoherenceWarning =
    state.loggingDeadline !== '' &&
    state.removalDeadline !== '' &&
    state.removalDeadline < state.loggingDeadline

  return (
    <div className="flex flex-col gap-sm">
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="wizard-areaHa" required>
            Pindala (ha)
          </FieldLabel>
          <input
            id="wizard-areaHa"
            type="number"
            min="0.01"
            step="0.01"
            value={state.areaHa}
            onChange={(event) => {
              patch({ areaHa: event.target.value })
            }}
            className={inputClass}
          />
          <FieldError message={errors.areaHa} />
        </div>
        {state.objectType === 'raieoigus' ? (
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="wizard-volumeM3" required>
              Raiemahu (m³)
            </FieldLabel>
            <input
              id="wizard-volumeM3"
              type="number"
              min="0"
              step="0.01"
              value={state.volumeM3}
              onChange={(event) => {
                patch({ volumeM3: event.target.value })
              }}
              className={inputClass}
            />
            <FieldError message={errors.volumeM3} />
          </div>
        ) : null}
      </div>

      <AuctionRepeater
        label="Katastritunnused"
        addLabel="+ Lisa katastritunnus"
        pasteLabel="Kleebi loend"
        values={state.cadastres}
        onChange={(cadastres) => {
          patch({ cadastres })
        }}
        validate={validateCadastre}
        errorMessage={errors.cadastres}
        hint={CADASTRE_HINT}
        placeholder="34801:001:0217"
        required
      />

      <AuctionRepeater
        label="Kinnistu registri numbrid"
        addLabel="+ Lisa registri number"
        pasteLabel="Kleebi loend"
        values={state.registryNumbers}
        onChange={(registryNumbers) => {
          patch({ registryNumbers })
        }}
        validate={validateNumeric}
        errorMessage={errors.registryNumbers}
        placeholder="150934"
      />

      <MultiSelectField
        label="Puuliigid"
        options={SPECIES_OPTIONS}
        values={state.species}
        onChange={(species) => {
          patch({ species })
        }}
        hint="Vali puuliikide koodid, mis lotil esinevad."
      />

      <MultiSelectField
        label="Raieliigid"
        options={LOGGING_TYPE_OPTIONS}
        values={state.loggingTypes}
        onChange={(loggingTypes) => {
          patch({ loggingTypes })
        }}
      />

      <AuctionRepeater
        label="Eraldised"
        addLabel="+ Lisa eraldised"
        pasteLabel="Kleebi loend"
        values={state.compartments}
        onChange={(compartments) => {
          patch({ compartments })
        }}
        validate={validateNonEmpty}
        errorMessage={errors.compartments}
        placeholder="4 VR"
      />

      <AuctionRepeater
        label="Metsateatise numbrid"
        addLabel="+ Lisa metsateatise number"
        pasteLabel="Kleebi loend"
        values={state.forestNotifications}
        onChange={(forestNotifications) => {
          patch({ forestNotifications })
        }}
        validate={validateNotification}
        errorMessage={errors.forestNotifications}
        placeholder="50001182112"
      />

      <fieldset className="flex flex-col gap-xs">
        <legend className="text-label font-semibold text-ink">Tähtajad</legend>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="wizard-loggingDeadline">Raie teostamise tähtaeg</FieldLabel>
            <input
              id="wizard-loggingDeadline"
              type="date"
              value={state.loggingDeadline}
              onChange={(event) => {
                patch({ loggingDeadline: event.target.value })
              }}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="wizard-removalDeadline">Väljaveo tähtaeg</FieldLabel>
            <input
              id="wizard-removalDeadline"
              type="date"
              value={state.removalDeadline}
              onChange={(event) => {
                patch({ removalDeadline: event.target.value })
              }}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="wizard-leaseDeadline">Rendi/kasutuslepingu tähtaeg</FieldLabel>
            <input
              id="wizard-leaseDeadline"
              type="date"
              value={state.leaseDeadline}
              onChange={(event) => {
                patch({ leaseDeadline: event.target.value })
              }}
              className={inputClass}
            />
          </div>
        </div>
        {deadlineCoherenceWarning ? (
          <WarningNote>
            Väljaveo tähtaeg on enne raie tähtaega — kontrolli kuupäevi üle.
          </WarningNote>
        ) : null}
        <FieldError message={errors.deadlines} />
      </fieldset>
    </div>
  )
}

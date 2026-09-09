'use client'

import { AuctionRepeater } from './AuctionRepeater'
import { MultiSelectField } from './MultiSelectField'
import { APPROVAL_OPTIONS, LOGGING_TYPE_OPTIONS, SPECIES_OPTIONS } from './wizard-model'
import type { WizardStepContext } from './wizard-model'
import { CheckboxToggle, FieldError, FieldHint, FieldLabel, WarningNote } from './wizard-ui'
import { inputClass } from '../../../_components/FormField'
import { CADASTRE_PATTERN } from '../_lib/auction-schema'

const CADASTRE_HINT = 'Katastritunnuse vorming peab olema NNNNN:NNN:NNNN (nt 34801:001:0217).'

// Metsaregister is an external state portal (docs/design/admin/03 step 3);
// the docs define no deep-link pattern for registry numbers, so the link
// targets the documented portal address and carries the first number.
const METSAREGISTER_URL = 'https://register.metsad.ee'

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

  // Rendi-/kasutusleping gate (docs 03 step 3): the checkbox shows and
  // requires the lease deadline. A stored deadline without the flag reads
  // as checked so existing lots keep their field visible.
  const hasLeaseAgreement = state.hasLeaseAgreement ?? state.leaseDeadline !== ''
  const firstRegistryNumber = state.registryNumbers
    .map((value) => value.trim())
    .find((value) => value !== '')

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
        <CheckboxToggle
          id="wizard-hasLeaseAgreement"
          label="Rendi-/kasutusleping"
          checked={hasLeaseAgreement}
          onChange={(checked) => {
            patch({ hasLeaseAgreement: checked })
          }}
        />
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
          {hasLeaseAgreement ? (
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="wizard-leaseDeadline" required>
                Rendi/kasutuslepingu tähtaeg
              </FieldLabel>
              <input
                id="wizard-leaseDeadline"
                type="date"
                value={state.leaseDeadline}
                onChange={(event) => {
                  patch({ leaseDeadline: event.target.value })
                }}
                className={inputClass}
              />
              <FieldError message={errors['deadlines.leaseDeadline']} />
            </div>
          ) : null}
        </div>
        {deadlineCoherenceWarning ? (
          <WarningNote>
            Väljaveo tähtaeg on enne raie tähtaega — kontrolli kuupäevi üle.
          </WarningNote>
        ) : null}
        <FieldError message={errors.deadlines} />
      </fieldset>

      <fieldset className="flex flex-col gap-xs">
        <legend className="text-label font-semibold text-ink">Kooskõlastused ja väljaveoteed</legend>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="wizard-storageLocationApproval">
              Kooskõlastused (ladustamiskohad)
            </FieldLabel>
            <select
              id="wizard-storageLocationApproval"
              value={state.storageLocationApproval ?? ''}
              onChange={(event) => {
                patch({ storageLocationApproval: event.target.value })
              }}
              className={inputClass}
            >
              <option value="">Valimata</option>
              {APPROVAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="wizard-removalRoads">Väljaveoteed</FieldLabel>
            <select
              id="wizard-removalRoads"
              value={state.removalRoads ?? ''}
              onChange={(event) => {
                patch({ removalRoads: event.target.value })
              }}
              className={inputClass}
            >
              <option value="">Valimata</option>
              {APPROVAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col gap-xs rounded-card border border-border bg-bgMist p-sm">
        <p className="text-label font-semibold text-ink">Automaatlingid</p>
        {firstRegistryNumber !== undefined ? (
          <a
            href={METSAREGISTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-label font-semibold text-primary underline-offset-2 hover:underline"
          >
            Ava Metsaregister ({firstRegistryNumber})
          </a>
        ) : (
          <FieldHint>
            Metsaregister avaneb pärast esimese kinnistu registri numbri lisamist.
          </FieldHint>
        )}
      </div>
    </div>
  )
}

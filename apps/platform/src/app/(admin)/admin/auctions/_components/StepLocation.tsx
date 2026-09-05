'use client'

import { MapEstonia, type MapPin } from '@erametsad/ui'

import { parseDecimal } from './wizard-model'
import type { WizardStepContext } from './wizard-model'
import { FieldError, FieldHint, FieldLabel } from './wizard-ui'
import { FormSelectField, inputClass } from '../../../_components/FormField'

const ESTONIA_CENTER: [number, number] = [58.6, 25.0]
const ESTONIA_ZOOM = 7
const PIN_ZOOM = 11

function coordinateValue(value: string, min: number, max: number): number | null {
  const parsed = parseDecimal(value)
  if (parsed === undefined || parsed < min || parsed > max) return null
  return parsed
}

export function StepLocation({ state, patch, errors, options }: WizardStepContext) {
  const countyOptions = [
    { value: '', label: '— vali maakond —' },
    ...options.counties.map((county) => ({ value: county.id, label: county.name })),
  ]
  const countyParishes = options.parishes.filter(
    (parish) => parish.countyId === state.countyId,
  )
  const parishOptions = [
    { value: '', label: '— vali vald —' },
    ...countyParishes.map((parish) => ({ value: parish.id, label: parish.name })),
  ]

  const lat = coordinateValue(state.lat, -90, 90)
  const lng = coordinateValue(state.lng, -180, 180)
  const hasPin = lat !== null && lng !== null
  const pins: MapPin[] = hasPin ? [{ lat, lng }] : []
  const firstCadastre = state.cadastres.map((value) => value.trim()).find((value) => value !== '')

  function changeCounty(countyId: string): void {
    const parishStillInCounty =
      state.parishId !== '' &&
      options.parishes.some(
        (parish) => parish.id === state.parishId && parish.countyId === countyId,
      )
    patch({ countyId, parishId: parishStillInCounty ? state.parishId : '' })
  }

  return (
    <div className="flex flex-col gap-sm">
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <FormSelectField
            label="Maakond"
            name="wizard-countyId"
            options={countyOptions}
            required
            value={state.countyId}
            onChange={(event) => {
              changeCounty(event.target.value)
            }}
          />
          <FieldError message={errors.countyId} />
        </div>
        <div className="flex flex-col gap-1">
          <FormSelectField
            label="Vald"
            name="wizard-parishId"
            options={parishOptions}
            required
            value={state.parishId}
            onChange={(event) => {
              patch({ parishId: event.target.value })
            }}
          />
          <FieldError message={errors.parishId} />
        </div>
      </div>
      <FieldHint>Vald filtreeritakse valitud maakonna järgi.</FieldHint>

      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor="wizard-address">Aadress (küla/tänav)</FieldLabel>
        <input
          id="wizard-address"
          value={state.address}
          onChange={(event) => {
            patch({ address: event.target.value })
          }}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="wizard-lat">Laiuskraad (-90..90)</FieldLabel>
          <input
            id="wizard-lat"
            inputMode="decimal"
            value={state.lat}
            placeholder="58.6342"
            onChange={(event) => {
              patch({ lat: event.target.value })
            }}
            className={`${inputClass} ${
              state.lat.trim() !== '' && lat === null ? 'border-danger' : ''
            }`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="wizard-lng">Pikkuskraad (-180..180)</FieldLabel>
          <input
            id="wizard-lng"
            inputMode="decimal"
            value={state.lng}
            placeholder="25.0"
            onChange={(event) => {
              patch({ lng: event.target.value })
            }}
            className={`${inputClass} ${
              state.lng.trim() !== '' && lng === null ? 'border-danger' : ''
            }`}
          />
          <FieldError message={errors.coordinates} />
        </div>
      </div>

      <div className="flex h-[400px] flex-col overflow-hidden rounded-card border border-border [&_.map-estonia]:h-full [&_.map-estonia]:min-h-0 [&_.map-estonia__fallback]:h-full [&_.map-estonia__fallback]:min-h-0">
        <MapEstonia
          pins={pins}
          center={hasPin ? [lat, lng] : ESTONIA_CENTER}
          zoom={hasPin ? PIN_ZOOM : ESTONIA_ZOOM}
        />
      </div>
      <FieldHint>
        Sisesta koordinaadid kümnendarvuna ja kontrolli asukohta kaardil. Pin tõmmatakse kaardile
        sisestatud laius- ja pikkuskraadi järgi.
      </FieldHint>

      <div className="flex flex-col gap-xs rounded-card border border-border bg-bgMist p-sm">
        <p className="text-label font-semibold text-ink">Automaatlingid</p>
        {firstCadastre !== undefined ? (
          <a
            href={`https://ky.kataster.ee/?cdr=${encodeURIComponent(firstCadastre)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-label font-semibold text-primary underline-offset-2 hover:underline"
          >
            Ava katastrikaart ({firstCadastre})
          </a>
        ) : (
          <FieldHint>
            Katastrikaart avaneb pärast esimese katastritunnuse lisamist (samm 3).
          </FieldHint>
        )}
        <a
          href="https://register.metsad.ee"
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit text-label font-semibold text-primary underline-offset-2 hover:underline"
        >
          Ava Metsaregister
        </a>
      </div>
    </div>
  )
}

'use client'

import { useId, useState } from 'react'

import { sanitizeRichText } from './wizard-model'
import type { WizardStepContext } from './wizard-model'
import { FieldError, FieldHint, FieldLabel } from './wizard-ui'
import { inputClass, secondaryButtonClass } from '../../../_components/FormField'

/**
 * Step 5 Sisu (docs/design/admin/03 step 5): name and slug, specialist
 * assign, the read-only alias address with regenerate, the two sanitised
 * copy fields and the image list with reorder. Uploads, focal points and
 * the file list arrive with the media step (task 2.6) — the list below is
 * bound to the payload state so 2.6 only swaps the editing affordances.
 */

const mediaAltErrorKey = (index: number): [string, string] => [
  `media.${String(index)}.alt`,
  `media[${String(index)}].alt`,
]

export function StepSisu({ state, patch, errors, initial, options }: WizardStepContext) {
  const id = useId()
  const [newImageUrl, setNewImageUrl] = useState('')

  const specialistOptions = options.specialists
  const specialistValueKnown =
    state.specialistId === '' ||
    specialistOptions.some((specialist) => specialist.id === state.specialistId)

  function patchMedia(index: number, alt: string): void {
    patch({
      media: state.media.map((item, i) => (i === index ? { ...item, alt } : item)),
    })
  }

  function moveMedia(index: number, delta: -1 | 1): void {
    const target = index + delta
    if (target < 0 || target >= state.media.length) return
    const next = [...state.media]
    const [moved] = next.splice(index, 1)
    if (moved === undefined) return
    next.splice(target, 0, moved)
    patch({ media: next })
  }

  function removeMedia(index: number): void {
    patch({ media: state.media.filter((_, i) => i !== index) })
  }

  function addMediaByUrl(): void {
    const url = newImageUrl.trim()
    if (url === '') return
    patch({ media: [...state.media, { url, alt: '' }] })
    setNewImageUrl('')
  }

  return (
    <div className="flex flex-col gap-sm">
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor={`${id}-title`} required>
            Nimi
          </FieldLabel>
          <input
            id={`${id}-title`}
            value={state.title}
            onChange={(event) => {
              patch({ title: event.target.value })
            }}
            className={`${inputClass} ${errors.title !== undefined ? 'border-danger' : ''}`}
          />
          <FieldHint>Kuvatakse oksjoni pealkirjana.</FieldHint>
          <FieldError message={errors.title} />
        </div>
        {initial.auctionId === null ? (
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={`${id}-slug`}>URL-nimi</FieldLabel>
            <input
              id={`${id}-slug`}
              value={state.slug}
              placeholder="harju-maa-raieoigus-2026"
              onChange={(event) => {
                patch({ slug: event.target.value })
              }}
              className={`${inputClass} ${errors.slug !== undefined ? 'border-danger' : ''}`}
            />
            <FieldHint>Valikuline — tühjana tekib pealkirjast.</FieldHint>
            <FieldError message={errors.slug} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={`${id}-specialist`} required>
          Spetsialist
        </FieldLabel>
        {options.canReassignSpecialist ? (
          <select
            id={`${id}-specialist`}
            value={state.specialistId}
            onChange={(event) => {
              patch({ specialistId: event.target.value })
            }}
            className={`${inputClass} max-w-md`}
          >
            <option value="">Määramata</option>
            {!specialistValueKnown && state.specialistId !== '' ? (
              <option value={state.specialistId}>{state.specialistId}</option>
            ) : null}
            {specialistOptions.map((specialist) => (
              <option key={specialist.id} value={specialist.id}>
                {specialist.name}
              </option>
            ))}
          </select>
        ) : (
          <FieldHint>
            Spetsialist märgitakse salvestamisel sulle endale; ümbermäärmine on admini õigus.
          </FieldHint>
        )}
        <FieldError message={errors.specialistId} />
      </div>

      <fieldset className="flex flex-col gap-xs rounded-card border border-border p-sm">
        <legend className="px-xs text-label font-semibold text-ink">Alias-aadress</legend>
        {initial.aliasEmail !== null ? (
          <div className="flex flex-wrap items-center gap-sm">
            <code className="rounded-input border border-border bg-bgMist px-sm py-xs font-mono text-body text-ink">
              {initial.aliasEmail}
            </code>
            {options.regenerateAliasEmail !== undefined ? (
              <button
                type="submit"
                formAction={options.regenerateAliasEmail}
                data-skip-validation="true"
                className={secondaryButtonClass}
              >
                Loo uus aadress
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-bodySm text-inkMuted">
            Loodakse pakkumiste aadress pärast esmast salvestamist.
          </p>
        )}
        <FieldHint>
          Pimepakkumiste e-posti aadress. Uue aadressi loomine logitakse auditisse; vana aadress
          enam kirju ei võta.
        </FieldHint>
      </fieldset>

      <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor={`${id}-descriptionPublic`}>Avalik info</FieldLabel>
          <textarea
            id={`${id}-descriptionPublic`}
            rows={8}
            value={state.descriptionPublic}
            onChange={(event) => {
              patch({ descriptionPublic: event.target.value })
            }}
            className={`${inputClass} h-auto py-2 ${errors.descriptionPublic !== undefined ? 'border-danger' : ''}`}
          />
          <FieldHint>
            Kuvatakse portaalis lõiguna “Oksjoni info ja erisused”.{' '}
            {String(sanitizeRichText(state.descriptionPublic).length)} / 20 000 tähemärki.
          </FieldHint>
          <FieldError message={errors.descriptionPublic} />
        </div>
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor={`${id}-descriptionSecondary`}>Täiendav info</FieldLabel>
          <textarea
            id={`${id}-descriptionSecondary`}
            rows={8}
            value={state.descriptionSecondary}
            onChange={(event) => {
              patch({ descriptionSecondary: event.target.value })
            }}
            className={`${inputClass} h-auto py-2 ${errors.descriptionSecondary !== undefined ? 'border-danger' : ''}`}
          />
          <FieldHint>
            Kuvatakse portaalis lõiguna “Lisainfo”.{' '}
            {String(sanitizeRichText(state.descriptionSecondary).length)} / 20 000 tähemärki.
          </FieldHint>
          <FieldError message={errors.descriptionSecondary} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-xs rounded-card border border-border p-sm">
        <legend className="px-xs text-label font-semibold text-ink">
          Pildid (hero ja galerii)
        </legend>
        <FieldHint>
          Igal pildil peab olema alternatiivtekst — ilma selleta avaldamine ei läbi. Üleslaadimine
          ja fookuspunkt tulevad meediahaldusega (ülesanne 2.6); siin saab järjekorda muuta ja
          URL-iga pilti lisada.
        </FieldHint>
        {state.media.length === 0 ? (
          <p className="text-bodySm text-inkMuted">Pilte ei ole lisatud.</p>
        ) : (
          <ol className="flex flex-col gap-xs">
            {state.media.map((item, index) => {
              const [schemaKey, gateKey] = mediaAltErrorKey(index)
              const altError = errors[schemaKey] ?? errors[gateKey]
              return (
                <li
                  key={`${String(index)}-${item.url}`}
                  className="flex flex-col gap-1 rounded-input border border-border bg-bgPage p-sm"
                >
                  <div className="flex flex-wrap items-center gap-xs">
                    <span className="rounded-pill bg-bgMist px-2 text-bodySm font-semibold text-ink">
                      {String(index + 1)}
                    </span>
                    <code className="min-w-0 flex-1 truncate font-mono text-bodySm text-inkMuted">
                      {item.url}
                    </code>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => {
                        moveMedia(index, -1)
                      }}
                      aria-label={`Tõsta pilt ${String(index + 1)} üles`}
                      className="rounded-button border border-border px-2 py-1 text-label text-ink disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === state.media.length - 1}
                      onClick={() => {
                        moveMedia(index, 1)
                      }}
                      aria-label={`Tõsta pilt ${String(index + 1)} alla`}
                      className="rounded-button border border-border px-2 py-1 text-label text-ink disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removeMedia(index)
                      }}
                      className="whitespace-nowrap rounded-button px-2 py-1 text-label text-inkMuted transition-colors duration-hover ease-hover hover:text-danger"
                    >
                      Eemalda
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor={`${id}-media-alt-${String(index)}`} required>
                      Alternatiivtekst
                    </FieldLabel>
                    <input
                      id={`${id}-media-alt-${String(index)}`}
                      value={item.alt}
                      onChange={(event) => {
                        patchMedia(index, event.target.value)
                      }}
                      className={`${inputClass} ${altError !== undefined ? 'border-danger' : ''}`}
                    />
                    <FieldError message={altError} />
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        <div className="flex items-center gap-xs">
          <input
            value={newImageUrl}
            placeholder="https://… pildi URL"
            onChange={(event) => {
              setNewImageUrl(event.target.value)
            }}
            className={`${inputClass} max-w-md`}
            aria-label="Uue pildi URL"
          />
          <button
            type="button"
            onClick={addMediaByUrl}
            className={secondaryButtonClass}
            disabled={newImageUrl.trim() === ''}
          >
            Lisa pilt
          </button>
        </div>
      </fieldset>
    </div>
  )
}

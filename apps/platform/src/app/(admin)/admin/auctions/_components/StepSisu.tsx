'use client'

import { useId } from 'react'

import { MediaStep } from './MediaStep'
import { sanitizeRichText } from './wizard-model'
import type { WizardStepContext } from './wizard-model'
import { FieldError, FieldHint, FieldLabel } from './wizard-ui'
import { inputClass, secondaryButtonClass } from '../../../_components/FormField'

/**
 * Step 5 Sisu (docs/design/admin/03 step 5): name and slug, specialist
 * assign, the read-only alias address with regenerate, the two sanitised
 * copy fields, then the media section (task 2.6) owning uploads, the image
 * list with alt/focal editing and the PDF attachment list.
 */

export function StepSisu({ state, patch, errors, initial, options }: WizardStepContext) {
  const id = useId()

  const specialistOptions = options.specialists
  const specialistValueKnown =
    state.specialistId === '' ||
    specialistOptions.some((specialist) => specialist.id === state.specialistId)

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

      <MediaStep state={state} patch={patch} errors={errors} initial={initial} options={options} />
    </div>
  )
}

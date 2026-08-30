import {
  FormField,
  FormSelectField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../_components/FormField'
import { auctionObjectTypeLabels, auctionTypeLabels } from '../../_lib/labels'

import type { AuctionDoc, CoreRepositories } from '@/lib/data/repositories'
import { auctionObjectTypes } from '@/lib/data/schema'

export interface AuctionFormOptions {
  counties: readonly { id: string; name: string }[]
  parishes: readonly { id: string; name: string; countyName: string | null }[]
  specialists: readonly { id: string; name: string }[]
}

const objectTypeOptions = auctionObjectTypes.map((type) => ({
  value: type,
  label: auctionObjectTypeLabels[type],
}))

const typeOptions = (['open', 'sealed'] as const).map((type) => ({
  value: type,
  label: auctionTypeLabels[type],
}))

/** datetime-local input value; keeps the stored ISO string's local-looking prefix. */
function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 16)
}

function eurValue(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '' : String(cents / 100)
}

export function AuctionForm({
  action,
  auction,
  options,
  submitLabel,
  cancelHref,
}: {
  action: (formData: FormData) => Promise<void>
  auction?: AuctionDoc | null
  options: AuctionFormOptions
  submitLabel: string
  cancelHref: string
}) {
  const countyOptions = [
    { value: '', label: '— vali maakond —' },
    ...options.counties.map((county) => ({ value: county.id, label: county.name })),
  ]
  const parishOptions = [
    { value: '', label: '— vali vald —' },
    ...options.parishes.map((parish) => ({
      value: parish.id,
      label: parish.countyName ? `${parish.name} (${parish.countyName})` : parish.name,
    })),
  ]
  const specialistOptions = [
    { value: '', label: '— vali spetsialist —' },
    ...options.specialists.map((specialist) => ({ value: specialist.id, label: specialist.name })),
  ]

  return (
    <form
      action={action}
      className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
    >
      {auction ? <input type="hidden" name="id" value={auction.id} /> : null}
      <FormField label="Pealkiri" name="title" required defaultValue={auction?.title ?? ''} />
      {!auction ? (
        <FormField
          label="URL-nimi"
          name="slug"
          required
          hint="Näiteks: harju-maa-raieoigus-2026"
        />
      ) : null}
      <FormSelectField
        label="Objekti tüüp"
        name="objectType"
        options={objectTypeOptions}
        defaultValue={auction?.objectType ?? 'raieoigus'}
      />
      <FormSelectField
        label="Oksjoni tüüp"
        name="type"
        options={typeOptions}
        defaultValue={auction?.type ?? 'open'}
        hint="Suletud (pitserta) oksjoni pakkumised krüptitakse kuni avamistseremoonian."
      />
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormField
          label="Lähtehind (EUR)"
          name="minBidEur"
          type="number"
          min="0"
          step="0.01"
          required
          defaultValue={eurValue(auction?.minBidCents)}
        />
        <FormField
          label="Pakkumise samm (EUR)"
          name="bidStepEur"
          type="number"
          min="0"
          step="0.01"
          defaultValue={eurValue(auction?.bidStepCents)}
        />
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormField
          label="Reservhind (EUR)"
          name="reservePriceEur"
          type="number"
          min="0"
          step="0.01"
          defaultValue={eurValue(auction?.reservePriceCents)}
          hint="Alapakkumise jaoks: allajääv müük lõpeb müümata."
        />
        <FormField
          label="Aadress"
          name="address"
          defaultValue={auction?.address ?? ''}
        />
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormField
          label="Algus"
          name="startsAt"
          type="datetime-local"
          defaultValue={toDatetimeLocalValue(auction?.startsAt)}
        />
        <FormField
          label="Lõpp"
          name="endsAt"
          type="datetime-local"
          defaultValue={toDatetimeLocalValue(auction?.endsAt)}
        />
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormSelectField
          label="Maakond"
          name="countyId"
          options={countyOptions}
          defaultValue={auction?.countyId ?? ''}
        />
        <FormSelectField
          label="Vald"
          name="parishId"
          options={parishOptions}
          defaultValue={auction?.parishId ?? ''}
        />
      </div>
      <FormSelectField
        label="Spetsialist"
        name="specialistId"
        options={specialistOptions}
        defaultValue={auction?.specialistId ?? ''}
      />
      <FormTextareaField
        label="Avalik kirjeldus"
        name="descriptionPublic"
        defaultValue={auction?.descriptionPublic ?? ''}
      />
      <FormTextareaField
        label="Lisainfo"
        name="descriptionSecondary"
        defaultValue={auction?.descriptionSecondary ?? ''}
      />
      <div className="flex items-center gap-sm pt-xs">
        <button type="submit" className={primaryButtonClass}>
          {submitLabel}
        </button>
        <a href={cancelHref} className={secondaryButtonClass}>
          Tühista
        </a>
      </div>
    </form>
  )
}

export async function loadAuctionFormOptions(
  repositories: CoreRepositories,
): Promise<AuctionFormOptions> {
  const [countyResult, parishResult, specialistResult] = await Promise.all([
    repositories.find({ collection: 'counties', sort: 'name', pagination: false }),
    repositories.find({ collection: 'parishes', sort: 'name', pagination: false }),
    repositories.find({
      collection: 'specialists',
      where: { active: { equals: true } },
      sort: 'name',
      pagination: false,
    }),
  ])
  const counties = countyResult.docs as { id: string; name: string }[]
  const countyNames = new Map(counties.map((county) => [county.id, county.name]))
  const parishes = (parishResult.docs as { id: string; name: string; countyId: string }[]).map(
    (parish) => ({
      id: parish.id,
      name: parish.name,
      countyName: countyNames.get(parish.countyId) ?? null,
    }),
  )
  const specialists = specialistResult.docs as { id: string; name: string }[]
  return { counties, parishes, specialists }
}

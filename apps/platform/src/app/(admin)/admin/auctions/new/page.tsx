import Link from 'next/link'

import { createAuctionAction } from '../../../_actions/auctions'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import {
  FormField,
  FormSelectField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { auctionObjectTypeLabels, auctionTypeLabels } from '../../../_lib/labels'

import { auctionObjectTypes } from '@/lib/data/schema'

export const metadata = { title: 'Uus oksjon' }

const objectTypeOptions = auctionObjectTypes.map((type) => ({
  value: type,
  label: auctionObjectTypeLabels[type],
}))

const typeOptions = (['open', 'sealed'] as const).map((type) => ({
  value: type,
  label: auctionTypeLabels[type],
}))

export default async function NewAuctionPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Uus oksjon"
        description="Loo mustandoksjon. Detailsema halduse ekraanid tulevad järgmises etapis."
        backHref="/admin/auctions"
      />
      <form
        action={createAuctionAction}
        className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
      >
        <FormField label="Pealkiri" name="title" required />
        <FormField
          label="URL-nimi"
          name="slug"
          required
          hint="Näiteks: harju-maa-raieoigus-2026"
        />
        <FormSelectField label="Objekti tüüp" name="objectType" options={objectTypeOptions} />
        <FormSelectField label="Oksjoni tüüp" name="type" options={typeOptions} />
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <FormField label="Lähtehind (EUR)" name="minBidEur" type="number" min="0" step="0.01" required />
          <FormField label="Pakkumise samm (EUR)" name="bidStepEur" type="number" min="0" step="0.01" />
        </div>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <FormField label="Algus" name="startsAt" type="datetime-local" />
          <FormField label="Lõpp" name="endsAt" type="datetime-local" />
        </div>
        <FormTextareaField label="Avalik kirjeldus" name="descriptionPublic" />
        <div className="flex items-center gap-sm pt-xs">
          <button type="submit" className={primaryButtonClass}>
            Salvesta
          </button>
          <Link href="/admin/auctions" className={secondaryButtonClass}>
            Tühista
          </Link>
        </div>
      </form>
    </div>
  )
}

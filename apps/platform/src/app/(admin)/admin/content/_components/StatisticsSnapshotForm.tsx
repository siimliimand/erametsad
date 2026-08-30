import Link from 'next/link'

import { saveStatisticsSnapshotAction } from '../../../_actions/content'
import {
  FormField,
  FormSelectField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { auctionObjectTypeLabels } from '../../../_lib/labels'

import type { StatisticsSnapshotDoc } from '@/lib/data/repositories'
import { auctionObjectTypes } from '@/lib/data/schema'

const objectTypeOptions = auctionObjectTypes.map((type) => ({
  value: type,
  label: auctionObjectTypeLabels[type],
}))

export function StatisticsSnapshotForm({ snapshot }: { snapshot?: StatisticsSnapshotDoc }) {
  return (
    <form
      action={saveStatisticsSnapshotAction}
      className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
    >
      {snapshot ? <input type="hidden" name="id" value={snapshot.id} /> : null}
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormField
          label="Kuupäev"
          name="date"
          type="date"
          required
          defaultValue={snapshot ? snapshot.date.slice(0, 10) : ''}
        />
        <FormSelectField
          label="Objekti tüüp"
          name="objectType"
          options={objectTypeOptions}
          defaultValue={snapshot?.objectType}
        />
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormField
          label="Arv"
          name="count"
          type="number"
          min="0"
          step="1"
          required
          defaultValue={snapshot ? String(snapshot.count) : '0'}
        />
        <FormField
          label="Summa (EUR)"
          name="eur"
          type="number"
          min="0"
          step="0.01"
          required
          hint="Sisesta eurodes, näiteks 1250.50. Salvestatakse sendina."
          defaultValue={snapshot ? String(snapshot.eur) : ''}
        />
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <FormField
          label="Pindala (ha)"
          name="area"
          type="number"
          min="0"
          step="0.01"
          defaultValue={snapshot?.area !== null && snapshot?.area !== undefined ? String(snapshot.area) : ''}
        />
        <FormField
          label="Maht (m³)"
          name="volume"
          type="number"
          min="0"
          step="0.01"
          defaultValue={
            snapshot?.volume !== null && snapshot?.volume !== undefined
              ? String(snapshot.volume)
              : ''
          }
        />
      </div>
      <div className="flex items-center gap-sm pt-xs">
        <button type="submit" className={primaryButtonClass}>
          Salvesta
        </button>
        <Link href="/admin/content/statistics" className={secondaryButtonClass}>
          Tühista
        </Link>
      </div>
    </form>
  )
}

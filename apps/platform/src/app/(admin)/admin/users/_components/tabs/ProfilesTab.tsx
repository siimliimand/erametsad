import { formatDateTime } from '../../../../_lib/labels'

import type { ProfileDoc } from '@/lib/data/repositories'

const approvalLabels: Record<string, string> = {
  pending: 'Ootel',
  approved: 'Kinnitatud',
  rejected: 'Tagasi lükatud',
}

export function ProfilesTab({ profiles }: { profiles: ProfileDoc[] }) {
  if (profiles.length === 0) {
    return (
      <div className="rounded-card border border-border bg-bgPage px-md py-lg text-center text-bodySm text-ink-muted">
        Kasutajal ei ole profiile.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
      {profiles.map((profile) => (
        <article
          key={profile.id}
          className="space-y-xs rounded-card border border-border bg-bgPage p-md"
        >
          <header className="flex items-center justify-between gap-sm">
            <h3 className="font-heading text-h5 font-bold text-ink">
              {profile.type === 'company' ? 'Ettevõtte profiil' : 'Eraprofiiil'}
            </h3>
            <span className="text-label font-semibold text-ink-muted">
              {approvalLabels[profile.approvalStatus] ?? profile.approvalStatus}
            </span>
          </header>
          <dl className="space-y-1 text-bodySm">
            <div className="flex justify-between gap-sm">
              <dt className="text-ink-muted">Kuvatav nimi</dt>
              <dd className="font-semibold text-ink">{profile.displayName ?? '—'}</dd>
            </div>
            {profile.type === 'company' ? (
              <>
                <div className="flex justify-between gap-sm">
                  <dt className="text-ink-muted">Ettevõte</dt>
                  <dd className="font-semibold text-ink">{profile.companyName ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-sm">
                  <dt className="text-ink-muted">Registrikood</dt>
                  <dd className="font-mono font-semibold text-ink">{profile.companyRegCode ?? '—'}</dd>
                </div>
              </>
            ) : null}
            <div className="flex justify-between gap-sm">
              <dt className="text-ink-muted">Telefon</dt>
              <dd className="font-semibold text-ink">{profile.phone ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-sm">
              <dt className="text-ink-muted">Loodud</dt>
              <dd className="font-semibold text-ink">{formatDateTime(profile.createdAt)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  )
}

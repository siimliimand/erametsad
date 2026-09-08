import {
  Activity as ActivityIcon,
  ChevronRight as ChevronRightIcon,
  FileSignature as FileSignatureIcon,
} from 'lucide-react'
import Link from 'next/link'
import type { ComponentType } from 'react'

import { WorkspaceCard } from './WorkspaceCard'
import { BuildingIcon } from '../../_components/icons'
import { workspaceCardLabels } from '../_lib/workspace'
import type { QuickActionRow } from '../_lib/workspace'


const actionIcons: Record<
  QuickActionRow['key'],
  ComponentType<{ className?: string }>
> = {
  'company-requests': BuildingIcon,
  underbids: ActivityIcon,
  'contracts-signing': FileSignatureIcon,
}

// "Kiire tegevus" (01 demo): queue rows with an icon tile, note line, count
// pill and a chevron that appears on hover. Underbid notes wear the amber
// warn tone — they need a decision, unlike informational notes.
export function QuickActions({ rows }: { rows: readonly QuickActionRow[] }) {
  return (
    <WorkspaceCard
      title={workspaceCardLabels.quickActions}
      titleId="h-quick"
    >
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-bodySm text-inkMuted">Tegevusi pole</p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => {
            const Icon = actionIcons[row.key]
            return (
              <Link
                key={row.key}
                href={row.href}
                className="group flex items-center gap-3 px-5 py-3 transition-colors duration-hover ease-hover hover:bg-bgMist"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-bgMist text-primary">
                  <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="text-bodySm leading-[18px] font-medium text-ink">
                    {row.title}
                  </span>
                  {row.note !== null ? (
                    <span
                      className={`text-label leading-4 ${
                        row.key === 'underbids'
                          ? 'text-[color:var(--st-ended-text)]'
                          : 'text-inkMuted'
                      }`}
                    >
                      {row.note}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 whitespace-nowrap rounded-pill bg-primaryLight px-2.5 py-0.5 text-label font-bold text-primary">
                  {row.countLabel}
                </span>
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-pill border border-transparent text-inkMuted transition-colors duration-hover ease-hover group-hover:border-border group-hover:bg-bgPage group-hover:text-primary"
                >
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </WorkspaceCard>
  )
}

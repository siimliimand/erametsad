/**
 * Audit action registry built from docs/design/admin/14-audit-log.md
 * (full action registry) plus the dotted keys the phase-5 writers emit.
 * The filter offers these groups; an action outside every group falls
 * into the "muu" bucket so it stays reachable under "Kõik".
 */

export interface AuditActionGroup {
  id: string
  label: string
  actions: readonly string[]
}

export const UNGROUPED_GROUP_ID = 'muu'

export const auditActionGroups: readonly AuditActionGroup[] = [
  {
    id: 'identity',
    label: 'Identiteet ja õigused',
    actions: [
      'user.identity_view',
      'user.right_grant',
      'user.right_revoke',
      'user.suspend',
      'user.ban',
      'user.force_logout',
      'user.impersonate',
      'user.gdpr_export',
      'user.gdpr_delete',
    ],
  },
  {
    id: 'auctions',
    label: 'Oksjonid',
    actions: [
      'auction.create',
      'auction.publish',
      'auction.schedule',
      'auction.update',
      'auction.end_manual',
      'auction.relist',
      'auction.archive',
      'auction.alias_regen',
      'auction.fee_override',
      'auction.export',
    ],
  },
  {
    id: 'sealed',
    label: 'Suletud avamine',
    actions: [
      'sealed.sign_opener',
      'sealed.sign_approver',
      'sealed.reveal',
      'sealed.winner_confirm',
      'sealed.void',
      'sealed.mark_unsold',
      'sealed.house_backup',
    ],
  },
  {
    id: 'bids',
    label: 'Pakkumised',
    actions: ['bid.approve', 'bid.reject', 'bid.export', 'anomaly.flag'],
  },
  {
    id: 'contracts',
    label: 'Lepingud',
    actions: [
      'contract.void',
      'contract.resend',
      'contract.download_container',
      'template.upload',
      'template.activate',
      'template.deactivate',
    ],
  },
  {
    id: 'companies',
    label: 'Ettevõtted',
    actions: ['company.approve', 'company.reject', 'company.hold', 'company.registry_view'],
  },
  {
    id: 'leads',
    label: 'Juhtlõimed',
    actions: [
      'lead.create_manual',
      'lead.assign',
      'lead.status',
      'lead.note',
      'lead.next_action',
      'lead.export',
      'lead.delete',
    ],
  },
  {
    id: 'requests',
    label: 'Päringud',
    actions: [
      'request.forward',
      'request.close',
      'request.mark_done',
      'request.mark_responded',
      'partner.create',
      'partner.update',
      'partner.delete',
      'partner.deactivate',
    ],
  },
  {
    id: 'content',
    label: 'Sisu',
    actions: [
      'content.publish',
      'content.schedule',
      'content.restore',
      'media.replace',
      'redirect.create',
      'redirect.delete',
      'menu.publish',
    ],
  },
  {
    id: 'settings',
    label: 'Seaded',
    actions: [
      'settings.change',
      'maintenance.start',
      'maintenance.cancel',
      'flag.toggle',
      'public_stats.change',
    ],
  },
  {
    id: 'audit',
    label: 'Audit',
    actions: ['audit.export'],
  },
]

const ACTIONS_BY_GROUP = new Map<string, ReadonlySet<string>>(
  auditActionGroups.map((group) => [group.id, new Set(group.actions)]),
)

/** Group id for an action key, or null when the action belongs to "muu". */
export function groupForAction(action: string): string | null {
  for (const group of auditActionGroups) {
    if (ACTIONS_BY_GROUP.get(group.id)?.has(action)) {
      return group.id
    }
  }
  return null
}

export function groupLabel(groupId: string): string {
  if (groupId === UNGROUPED_GROUP_ID) return 'Muud tegevused'
  return auditActionGroups.find((group) => group.id === groupId)?.label ?? groupId
}

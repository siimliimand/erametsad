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
      'user.shill_flag',
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
    actions: ['bid.approve', 'bid.reject', 'bid.export', 'anomaly.flag', 'bid.void'],
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
      'content.version.create',
      'content.version.restore',
      'content.blocks.save',
      'media.replace',
      'redirect.create',
      'redirect.update',
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
      'maintenance.end',
      'maintenance.window_create',
      'maintenance.window_delete',
      'flag.toggle',
      'public_stats.change',
      'settings.key_reveal',
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

/**
 * Per-action Estonian human labels (spec admin-governance, task 1.7 +
 * 4.7): full coverage of the registry groups plus the dotted keys the
 * writers emit outside them. Unmapped keys fall back to the raw key so the
 * UI never shows an empty action.
 */
const auditActionLabels: Record<string, string> = {
  // Identiteet ja õigused
  'user.identity_view': 'Isikuandmete vaatamine',
  'user.right_grant': 'Pakkumisõiguse andmine',
  'user.right_revoke': 'Pakkumisõiguse tühistamine',
  'user.suspend': 'Konto peatamine',
  'user.ban': 'Konto keelamine',
  'user.force_logout': 'Sunnitud väljalogimine',
  'user.impersonate': 'Vaatluse seanss',
  'user.gdpr_export': 'Isikuandmete eksport',
  'user.gdpr_delete': 'Konto kustutamine',
  'user.shill_flag': 'Shill-uurimise märkimine',
  // Oksjonid
  'auction.create': 'Oksjoni loomine',
  'auction.publish': 'Oksjoni avaldamine',
  'auction.schedule': 'Oksjoni ajastamine',
  'auction.update': 'Oksjoni muutmine',
  'auction.end_manual': 'Oksjoni enneaegne lõpetamine',
  'auction.relist': 'Oksjoni uuesti esile panek',
  'auction.archive': 'Oksjoni arhiveerimine',
  'auction.alias_regen': 'Alias-aadressi uuesti genereerimine',
  'auction.fee_override': 'Tasude ülekirjutamine',
  'auction.export': 'Oksjoni eksport',
  // Suletud avamine
  'sealed.sign_opener': 'Avaja allkiri',
  'sealed.sign_approver': 'Kinnitaja allkiri',
  'sealed.reveal': 'Pakkumiste avamine',
  'sealed.winner_confirm': 'Võitja kinnitamine',
  'sealed.void': 'Avamise tühistamine',
  'sealed.mark_unsold': 'Müümata märkimine',
  'sealed.house_backup': 'Varupakkumise otsus',
  // Pakkumised
  'bid.approve': 'Pakkumise kinnitamine',
  'bid.reject': 'Pakkumise tagasilükkamine',
  'bid.export': 'Pakkumiste eksport',
  'bid.void': 'Juhtiva pakkumise tühistamine',
  'anomaly.flag': 'Anomaalia märkimine',
  // Lepingud
  'contract.void': 'Lepingu tühistamine',
  'contract.resend': 'Lepingu uuesti saatmine',
  'contract.download_container': 'Lepingu konteineri allalaadimine',
  'template.upload': 'Lepingu malli üleslaadimine',
  'template.activate': 'Lepingu malli aktiveerimine',
  'template.deactivate': 'Lepingu malli deaktiveerimine',
  // Ettevõtted
  'company.approve': 'Ettevõtte kinnitamine',
  'company.reject': 'Ettevõtte taotluse keeld',
  'company.hold': 'Ettevõtte taotluse hoid',
  'company.registry_view': 'Ettevõtte registri vaatamine',
  // Juhtlõimed
  'lead.create_manual': 'Juhtlõime loomine',
  'lead.assign': 'Juhtlõime määramine',
  'lead.status': 'Juhtlõime oleku muutmine',
  'lead.note': 'Juhtlõime märkuse lisamine',
  'lead.next_action': 'Juhtlõime järgmise tegevuse määramine',
  'lead.export': 'Juhtlõimede eksport',
  'lead.delete': 'Juhtlõime kustutamine',
  // Päringud
  'request.forward': 'Päringu edastamine',
  'request.close': 'Päringu sulgemine',
  'request.mark_done': 'Päringu teostatuks märkimine',
  'request.mark_responded': 'Päringu vastatuks märkimine',
  'partner.create': 'Partneri loomine',
  'partner.update': 'Partneri muutmine',
  'partner.delete': 'Partneri kustutamine',
  'partner.deactivate': 'Partneri deaktiveerimine',
  // Sisu
  'content.publish': 'Sisu avaldamine',
  'content.schedule': 'Sisu avaldamise ajastamine',
  'content.restore': 'Sisu taastamine',
  'content.version.create': 'Lehe versiooni salvestamine',
  'content.version.restore': 'Lehe versiooni taastamine',
  'content.blocks.save': 'Lehe blokkide salvestamine',
  'media.replace': 'Meediafaili asendamine',
  'redirect.create': 'Suunamise loomine',
  'redirect.update': 'Suunamise muutmine',
  'redirect.delete': 'Suunamise kustutamine',
  'menu.publish': 'Menüü avaldamine',
  // Seaded
  'settings.change': 'Seadete muutmine',
  'maintenance.start': 'Hooldusrežiimi sisselülitamine',
  'maintenance.end': 'Hooldusrežiimi väljalülitamine',
  'maintenance.window_create': 'Hooldusakna loomine',
  'maintenance.window_delete': 'Hooldusakna kustutamine',
  'flag.toggle': 'Lüliti lülitamine',
  'public_stats.change': 'Avalike statistikate muutmine',
  'settings.key_reveal': 'Integratsioonivõtme paljastamine',
  // Audit
  'audit.export': 'Auditlogi eksport',
}

export function actionLabel(action: string): string {
  return auditActionLabels[action] ?? action
}

/**
 * Browser family for the drawer's "Brauser" field (spec: user-agent
 * family). Order matters: Edge/Opera/Samsung ride a Chromium UA, so their
 * markers are checked before Chrome, and Chrome before Safari.
 */
export function userAgentFamily(userAgent: string | null | undefined): string {
  if (!userAgent || userAgent.trim().length === 0) return '—'
  const families: readonly (readonly [RegExp, string])[] = [
    [/Edg\//, 'Edge'],
    [/OPR\/|Opera/, 'Opera'],
    [/SamsungBrowser\//, 'Samsung Internet'],
    [/FxiOS\/|Firefox\//, 'Firefox'],
    [/CriOS\/|Chrome\//, 'Chrome'],
    [/Safari\//, 'Safari'],
    [/curl\//, 'curl'],
  ]
  for (const [pattern, label] of families) {
    if (pattern.test(userAgent)) return label
  }
  return 'Tundmatu'
}

/**
 * Reason for the Põhjus column and drawer (spec scenario: a settings save
 * with a reason shows it in both). The dedicated era column wins; legacy
 * entries keep their reason only inside the before/after JSON, so those are
 * checked next.
 */
export function auditEntryReason(entry: {
  reason?: string | null
  before?: unknown
  after?: unknown
}): string | null {
  if (typeof entry.reason === 'string' && entry.reason.trim().length > 0) {
    return entry.reason.trim()
  }
  for (const payload of [entry.after, entry.before]) {
    if (typeof payload === 'object' && payload !== null) {
      const reason = (payload as Record<string, unknown>).reason
      if (typeof reason === 'string' && reason.trim().length > 0) {
        return reason.trim()
      }
    }
  }
  return null
}

/**
 * Entity-type labels for the audit list and detail drawer (same map the
 * page used to carry; page files do not export helpers).
 */
const entityTypeLabels: Record<string, string> = {
  user: 'Kasutaja',
  auction: 'Oksjon',
  bid: 'Pakkumine',
  contract: 'Leping',
  lead: 'Juhtlõim',
  partner: 'Partner',
  settings: 'Seaded',
  article: 'Artikkel',
  page: 'Leht',
  redirect: 'Ümbersuunamine',
  'company-access-request': 'Ettevõtte päring',
  'service-request': 'Teenuse päring',
  'contract-template': 'Lepingu mall',
}

export function entityTypeLabel(entityType: string | null): string {
  if (!entityType) return '—'
  return entityTypeLabels[entityType] ?? entityType
}

/**
 * Actions whose recorded outcome is a refusal or a negative decision; the
 * detail drawer's result chip renders these as "Keeldutud", everything
 * else as "OK" (demo 14-audit-log result column).
 */
const DENY_AUDIT_ACTIONS: ReadonlySet<string> = new Set(['bid.reject', 'company.reject'])

export function auditEntryDenies(action: string): boolean {
  return DENY_AUDIT_ACTIONS.has(action)
}

/* eslint-disable no-console */
import type { CoreDatabase } from '../repositories'
import { notificationTemplates } from '../schema'

/**
 * Active version-1 rows for the portal-submission notifications (change
 * portal-object-submission). The dispatcher composes these bodies in code
 * from the event payload; the rows make the texts visible and versionable
 * in the admin Teavitused store. Variables use the {{name}} convention the
 * template editor substitutes on a test send.
 */
const TEMPLATE_SEEDS = [
  {
    event: 'submission.received',
    channel: 'email' as const,
    subject: 'Teie pakkumine on meile jõudnud',
    body: [
      'Teie pakkumine "{{objectTitle}}" on edukalt esitatud.',
      '',
      'Meie spetsialist vaatab pakkumise läbi ja võtab teiega peagi ühendust.',
      '',
      'Lugupidamisega',
      'Erametsad',
    ].join('\n'),
  },
  {
    event: 'submission.new',
    channel: 'email' as const,
    subject: 'Uus objektipakkumine on teile määratud',
    body: [
      'Teile on määratud uus objektipakkumine "{{objectTitle}}" (esitaja: {{submitterName}}).',
      '',
      'Palun vaadake pakkumine haldusliideses üle.',
      '',
      'Erametsad',
    ].join('\n'),
  },
]

export async function seedNotificationTemplates(db: CoreDatabase): Promise<void> {
  const existing = await db.select({ event: notificationTemplates.event }).from(notificationTemplates)
  const pending = TEMPLATE_SEEDS.filter((template) => !existing.some((row) => row.event === template.event))
  if (pending.length === 0) {
    console.log('Notification templates already seeded, skipping')
    return
  }

  const nowIso = new Date().toISOString()
  for (const template of pending) {
    await db.insert(notificationTemplates).values({
      ...template,
      version: 1,
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    })
  }

  console.log(`Seeded notification templates: ${pending.map((template) => template.event).join(', ')}`)
}

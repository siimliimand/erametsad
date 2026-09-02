// Newsletter double opt-in confirmation. Direct-marketing pipeline, so the
// sender must attach marketingEmailHeaders() (List-Unsubscribe) from
// lib/notifications/email-sender.
export function newsletterConfirmationTemplate(params: { confirmUrl: string }): string {
  return [
    'Tere!',
    '',
    'Kinnitamaks uudiskirja tellimust avage järgmine link:',
    params.confirmUrl,
    '',
    'Link kehtib ühe korra. Kui te ei ole Eametsa uudiskirja tellinud, ignoreerige seda kirja.',
    '',
    'Lugupidamisega',
    'Erametsad',
  ].join('\n')
}

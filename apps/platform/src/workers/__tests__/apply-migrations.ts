import { applyD1Migrations, env } from 'cloudflare:test'

await applyD1Migrations(env.DB, env.D1_MIGRATIONS)

// Task 4.3 ships these columns with its own migration, which can land
// before or after this suite on the shared tree. Added idempotently here
// so notifications reads (drizzle selects every model column) work in both
// states; a duplicate-column error means the migration already ran.
for (const column of ['send_result TEXT', 'recipient_results TEXT', 'error_code TEXT']) {
  await env.DB.exec(`ALTER TABLE notifications ADD COLUMN ${column}`).catch(() => undefined)
}

/**
 * Drawer-side AuditDiff: reuses the shared two-column before/after diff
 * (admin-ui D5) so masking, leaf compare, and collapse behavior stay in one
 * place. Kept as a local module per the change's component layout so the
 * audit drawer's import surface stays inside admin/audit/_components/.
 */
import { AuditDiff as SharedAuditDiff } from '../../../_components/AuditDiff'

export function AuditDiff({ before, after }: { before: unknown; after: unknown }) {
  return <SharedAuditDiff before={before} after={after} />
}

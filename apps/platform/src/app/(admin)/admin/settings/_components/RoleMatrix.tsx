import { LockIcon } from '../../../_components/icons'
import {
  adminPermissions,
  can,
  type AdminPermission,
  type StaffRole,
} from '../../../_lib/permissions'

/**
 * Read-only role × permission matrix generated from permissions.ts via
 * can(): nothing here is editable, the UI only mirrors the code-defined
 * grants (demo 13-settings "Rollid ja õigused"). The Superadmin column is
 * always full and visually locked.
 */

interface PermissionGroup {
  label: string
  permissions: readonly AdminPermission[]
}

// Demo group order. Every AdminPermission not listed here lands in the
// generated "Muud õigused" row, so the matrix can never silently lag
// behind permissions.ts.
const permissionGroups: readonly PermissionGroup[] = [
  { label: 'Töölaud', permissions: ['workspace:view'] },
  {
    label: 'Oksjonid',
    permissions: [
      'auctions:read',
      'auctions:write',
      'auctions:end-manual',
      'auctions:archive',
      'auctions:export',
      'auctions:fee-override',
      'auctions:reassign-specialist',
    ],
  },
  {
    label: 'Pakkumised ja sulgemise avamine',
    permissions: ['bids:read', 'bids:write', 'underbids:decide', 'sealed:read', 'sealed:operate'],
  },
  {
    label: 'Juhtlõimed ja päringud',
    permissions: ['leads:read', 'leads:write', 'inquiries:read', 'inquiries:write'],
  },
  {
    label: 'Kasutajad ja ettevõtted',
    permissions: ['users:read', 'users:write', 'companies:read', 'companies:write'],
  },
  { label: 'Lepingud', permissions: ['contracts:read', 'contracts:write'] },
  { label: 'Sisu', permissions: ['content:read', 'content:write'] },
  { label: 'Statistika', permissions: ['statistics:read'] },
  { label: 'Seaded', permissions: ['settings:read', 'settings:write'] },
  { label: 'Auditlogi', permissions: ['audit:read'] },
]

function buildMatrixRows(): readonly PermissionGroup[] {
  const covered = new Set<AdminPermission>(permissionGroups.flatMap((group) => group.permissions))
  const uncovered = adminPermissions.filter((permission) => !covered.has(permission))
  if (uncovered.length === 0) {
    return permissionGroups
  }
  return [...permissionGroups, { label: 'Muud õigused', permissions: uncovered }]
}

const matrixRows = buildMatrixRows()

// Column order matches the demo (13-settings): Superadmin last and locked.
const matrixRoles = ['specialist', 'seller', 'admin', 'superadmin'] as const satisfies readonly StaffRole[]

const roleLabels: Record<StaffRole, string> = {
  admin: 'Admin',
  superadmin: 'Superadmin',
  specialist: 'Spetsialist',
  seller: 'Müüja',
}

type GroupState = 'all' | 'some' | 'none'

function groupState(role: StaffRole, permissions: readonly AdminPermission[]): GroupState {
  const granted = permissions.filter((permission) => can(role, permission)).length
  if (granted === 0) return 'none'
  return granted === permissions.length ? 'all' : 'some'
}

function MatrixCell({
  state,
  label,
  locked,
}: {
  state: GroupState
  label: string
  locked?: boolean
}) {
  if (state === 'some') {
    return (
      <td className={`border-t border-border px-3 py-2.5 text-center ${locked ? 'bg-bgMist' : ''}`}>
        <span
          role="img"
          aria-label={`${label} (osaliselt lubatud)`}
          title="Osaliselt lubatud"
          className="font-semibold text-inkMuted"
        >
          –
        </span>
      </td>
    )
  }
  return (
    <td className={`border-t border-border px-3 py-2.5 text-center ${locked ? 'bg-bgMist' : ''}`}>
      <input
        type="checkbox"
        checked={state === 'all'}
        disabled
        readOnly
        aria-label={`${label} (${state === 'all' ? 'lubatud' : 'keelatud'}${locked ? ', alati lubatud' : ''})`}
        className="h-[15px] w-[15px] accent-primary disabled:opacity-45"
      />
    </td>
  )
}

export function RoleMatrix() {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-bodySm">
          <thead>
            <tr>
              <th
                scope="col"
                className="border-b border-border bg-bgMist px-4 py-2.5 text-left text-label font-medium text-inkMuted"
              >
                Õigus
              </th>
              {matrixRoles.map((role) => (
                <th
                  key={role}
                  scope="col"
                  className="border-b border-border bg-bgMist px-3 py-2.5 text-center text-label font-medium text-inkMuted"
                >
                  {role === 'superadmin' ? (
                    <span className="inline-flex items-center gap-1">
                      <LockIcon className="h-3.5 w-3.5 text-inkMuted" />
                      {roleLabels[role]}
                    </span>
                  ) : (
                    roleLabels[role]
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixRows.map((group) => (
              <tr key={group.label}>
                <td className="border-t border-border px-4 py-2.5 font-medium text-ink">
                  {group.label}
                </td>
                {matrixRoles.map((role) => (
                  <MatrixCell
                    key={role}
                    state={groupState(role, group.permissions)}
                    label={`${roleLabels[role]}: ${group.label}`}
                    locked={role === 'superadmin'}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-3 text-label text-inkMuted">
        Õigused on määratletud koodis (permissions.ts) ega ole siin kasutajaliidestest muudetavad.
        Superadmini veerg on alati täielik ja lukustatud.
      </p>
    </div>
  )
}

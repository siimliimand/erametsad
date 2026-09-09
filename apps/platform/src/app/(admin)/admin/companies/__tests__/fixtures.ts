import type { RegistrySnapshot } from '../../leads/_components/registry-snapshot'
import type { RequestCardData } from '../_components/RequestCard'

import type { CompanyAccessRequest } from '@/lib/data/schema'

/** Fully valid pending request row; overrides keep each test's focus tight. */
export function makeRequest(overrides: Partial<CompanyAccessRequest> = {}): CompanyAccessRequest {
  return {
    id: 'c0a80101-0000-0000-0000-000000000001',
    regCode: '12345678',
    companyName: 'Mari Mets OÜ',
    requesterName: 'Mari Maasikas',
    requesterPhone: '+372 5555 0100',
    requesterEmail: 'mari.maasikas@example.ee',
    reason: 'Soovin pakkumisi esitada.',
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    ...overrides,
  }
}

/** Registry hit with the applicant on the board (weak name match). */
export function makeSnapshot(overrides: Partial<RegistrySnapshot> = {}): RegistrySnapshot {
  return {
    status: 'REGISTREERITUD',
    legalName: 'Mari Mets OÜ',
    legalForm: 'Osaühing',
    address: 'Pärnu mnt 12, Tartu',
    kmkrNr: 'EE101234567',
    boardMembers: [{ name: 'Mari Maasikas', role: 'Juhatuse liige' }],
    fetchedAt: '2026-08-01T09:00:00.000Z',
    verified: true,
    ...overrides,
  }
}

export function makeRequestCardData(
  overrides: Partial<RequestCardData> = {},
): RequestCardData {
  return {
    request: makeRequest(),
    snapshot: makeSnapshot(),
    applicant: {
      id: 'user-9',
      name: 'Mari Maasikas',
      isikukoodMasked: '••••••0100',
      accountAge: '01.08.2025 12:00',
    },
    boardCheck: { level: 'weak', matchedName: 'Mari Maasikas' },
    duplicate: null,
    waitingDays: 3,
    ...overrides,
  }
}

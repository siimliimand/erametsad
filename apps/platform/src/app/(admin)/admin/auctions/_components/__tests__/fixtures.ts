import type { AuctionTableRow } from '../AuctionsTable'
import type { AuctionWizardInitial, AuctionWizardState } from '../wizard-model'

/** Minimal serialized table row; overrides keep each test's focus tight. */
export function makeTableRow(overrides: Partial<AuctionTableRow> = {}): AuctionTableRow {
  return {
    id: 'a1b2c3d4-0000-0000-0000-000000000001',
    title: 'Harjumaa raieõigus',
    objectType: 'raieoigus',
    type: 'open',
    isQuickAuction: false,
    status: 'scheduled',
    countyName: 'Harjumaa',
    minBidCents: 300000,
    minBidLabel: '3 000 €',
    endsAt: '2026-12-10T10:00:00.000Z',
    endsLabel: '10.12.2026 12:00',
    bidCount: 4,
    pendingCount: 0,
    specialistName: 'Mari Maasikas',
    specialistInitials: 'MM',
    portalHref: '/oksjon/harjumaa-raieoigus',
    editHref: '/admin/auctions/a1b2c3d4-0000-0000-0000-000000000001',
    canEnd: false,
    canArchive: false,
    canRelist: false,
    ...overrides,
  }
}

/** Fully valid wizard state; every field the schema expects is filled. */
export const baseWizardState: AuctionWizardState = {
  title: 'Harjumaa raieõigus',
  slug: '',
  objectType: 'raieoigus',
  auctionType: 'open',
  isQuickAuction: false,
  antiSnipeEnabled: true,
  antiSnipeMinutes: '5',
  startsAt: '2026-12-01T12:00',
  endsAt: '2026-12-10T12:00',
  minBidEur: '3000',
  bidStepEur: '50',
  reserveEur: '',
  reserveEditing: false,
  feeOverridePercent: '',
  countyId: 'c1',
  parishId: 'p1',
  address: 'Metsa tänav 1',
  lat: '58.6342',
  lng: '25.0',
  cadastres: ['34801:001:0217'],
  registryNumbers: ['150934'],
  compartments: ['4 VR'],
  forestNotifications: ['50001182112'],
  species: ['MA', 'KU'],
  loggingTypes: ['VR', 'HR'],
  areaHa: '12.4',
  volumeM3: '980',
  loggingDeadline: '2027-12-31',
  removalDeadline: '2028-03-31',
  leaseDeadline: '',
  propertyCount: null,
  specialistId: 'spec-1',
  descriptionPublic: 'Avalik info',
  descriptionSecondary: 'Täiendav info',
  media: [{ url: 'https://cdn.example/hero.jpg', alt: 'Mets' }],
  packageHeader: '',
  packageRows: [],
}

export const createWizardInitial: AuctionWizardInitial = {
  auctionId: null,
  mechanicsLocked: false,
  hasReserve: false,
  aliasEmail: null,
  guestPreviewHref: null,
  state: baseWizardState,
}

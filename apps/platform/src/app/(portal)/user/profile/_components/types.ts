export type ProfileTypeView = 'private' | 'company'

export type ApprovalStatusView = 'pending' | 'approved' | 'rejected'

export type ObjectTypeView = 'raieoigus' | 'kinnistu' | 'kiire' | 'pakett'

/** Shape returned by GET/PATCH /api/v1/profiles. */
export interface ProfileView {
  id: string
  type: ProfileTypeView
  displayName: string | null
  phone: string | null
  approvalStatus: ApprovalStatusView
  termsConsentAt: string | null
  privacyConsentAt: string | null
  marketingConsentAt: string | null
  createdAt: string
  updatedAt: string
  companyName: string | null
  companyRegCode: string | null
}

/** Caller's own identity columns; isikukood is read-only by design. */
export interface UserIdentity {
  isikukood: string | null
  eidVerified: boolean
}

/** Row of GET /api/v1/my/auction-rights. */
export interface RightView {
  objectType: ObjectTypeView
  granted: boolean
  grantedAt: string | null
  revokedAt: string | null
}

/** Row of GET /api/v1/my/sessions. */
export interface SessionView {
  id: string
  createdAt: string
  current: boolean
}

/**
 * Pure consequence model for the contract void flow (spec delta
 * admin-commerce-ops "Void double confirm" + framework prompt). Lives
 * outside the 'use server' actions module so the client dialog and the
 * tests can import it without crossing the server boundary.
 */

export type VoidOutcome = 'contract' | 'contract-and-result'

/** Second-step keyword guard, mirroring the GDPR tab's typed confirm. */
export const VOID_CONFIRM_KEYWORD = 'TÜHISTA'

/** Same minimum the server action enforces (contracts.ts MIN_REASON_LENGTH). */
export const VOID_REASON_MIN_LENGTH = 5

export interface VoidConsequencesInput {
  /** Template type is `framework` (raamleping). */
  isFramework: boolean
  /** The lot sits in the `contract` state, so a superadmin outcome reverts it. */
  auctionRevertEligible: boolean
  isSuperadmin: boolean
  outcome: VoidOutcome
  /** contract.signedBy — the account holder the framework gate binds. */
  signerUserId: string | null
}

export interface VoidConsequences {
  /** The chosen outcome reverts the auction result (superadmin + lot in `contract`). */
  auctionReverts: boolean
  /** Framework contract: voiding closes the open-auction bidding gate. */
  frameworkRightsRevoked: boolean
  /** Admin users rights view deep link for the framework signer. */
  rightsMatrixPath: string | null
  /** Estonian consequence lines for the dialog, in fixed stacking order. */
  lines: readonly string[]
}

export function listVoidConsequences(input: VoidConsequencesInput): VoidConsequences {
  const auctionReverts =
    input.outcome === 'contract-and-result' &&
    input.isSuperadmin &&
    input.auctionRevertEligible
  const frameworkRightsRevoked = input.isFramework
  const rightsMatrixPath =
    frameworkRightsRevoked && input.signerUserId
      ? `/admin/users/${input.signerUserId}?tab=oigused`
      : null

  const lines = [
    'Leping läheb olekusse "tühistatud" ja seda ei saa tagasi pöörata.',
    ...(auctionReverts
      ? [
          'Oksjoni tulemus tühistatakse: lot läheb tagasi olekusse "lõppenud", võidupakkumine ja lõpphind nullitakse.',
        ]
      : []),
    ...(frameworkRightsRevoked
      ? [
          'Raamlepingu tühistamine sulgeb kasutaja pakkumise võimaluse avatud oksjonitel kuni uue raamlepingu allkirjastamiseni.',
        ]
      : []),
    'Tühistamise põhjus ja tulemus kantakse auditilogisse.',
  ]

  return { auctionReverts, frameworkRightsRevoked, rightsMatrixPath, lines }
}

import type { EECountyCode, ServiceRequestType } from '@erametsad/types'

/**
 * Minimal structural shape the router needs. `PartnerDoc` (the decoded
 * partners row) satisfies it; kept narrow so the selection stays a pure
 * function testable without a database.
 */
export interface RoutablePartner {
  id: string
  active: boolean
  serviceTypes: readonly unknown[] | null
  counties: readonly unknown[] | null
}

function listIncludes(list: readonly unknown[] | null, value: string): boolean {
  return Array.isArray(list) && list.includes(value)
}

/**
 * Active partners whose service types include the request type and whose
 * county coverage includes the request county. A null or empty counties
 * list means every county. `county` is null for kava, which has no county
 * field, so every matching partner qualifies regardless of coverage.
 */
export function selectPartners<T extends RoutablePartner>(
  partners: readonly T[],
  type: ServiceRequestType,
  county?: EECountyCode | null,
): T[] {
  return partners.filter(
    (partner) =>
      partner.active &&
      listIncludes(partner.serviceTypes, type) &&
      (county == null ||
        partner.counties == null ||
        partner.counties.length === 0 ||
        listIncludes(partner.counties, county)),
  )
}

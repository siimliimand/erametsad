/**
 * URL `view` contract (also consumed by the page's map branch): the canonical
 * `view=kaart` and the legacy `view=kart` both select the map view; a missing
 * param or any other value is the Loendivaade default. The toolbar writes
 * `view=kaart` and drops the param when switching back to the list.
 *
 * Lives outside the 'use client' ListingResultsBar because the listing page's
 * server component calls it directly; a function exported from a client module
 * is a client reference and throws when invoked during SSR.
 */
export function isMapView(raw: string | string[] | undefined): boolean {
  const value = Array.isArray(raw) ? raw[0] : raw
  return value === 'kaart' || value === 'kart'
}

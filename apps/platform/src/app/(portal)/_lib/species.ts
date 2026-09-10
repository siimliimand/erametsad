// Seed data stores species as lowercase Estonian names ('mänd', …) and
// legacy code strings ('ma', …), and no label taxonomy exists in the
// repo, so every display form of a species derives from this one table:
// filter chips show the demo code (title carries the Estonian name)
// while the lot card needs the plain Estonian name via speciesNames.
//
// The set and codes mirror the demo listing (design Decision 6):
// MA Mänd, KU Kuusk, KS Kask, HB Haab, LM Lehis, SA Saar. `ha` keeps
// its data-layer value so shared `species=ha` links keep working, and
// unknown codes still pass through speciesNames verbatim.

export const SPECIES = [
  { value: 'ma', code: 'MA', name: 'Mänd' },
  { value: 'ku', code: 'KU', name: 'Kuusk' },
  { value: 'ks', code: 'KS', name: 'Kask' },
  { value: 'ha', code: 'HB', name: 'Haab' },
  { value: 'lm', code: 'LM', name: 'Lehis' },
  { value: 'sa', code: 'SA', name: 'Saar' },
] as const

export type SpeciesCode = (typeof SPECIES)[number]['value']

/**
 * Display names for species codes, in input order. Unknown codes pass
 * through verbatim so stored data is never silently dropped.
 */
export function speciesNames(codes: string[]): string[] {
  return codes.map((code) => SPECIES.find((species) => species.value === code)?.name ?? code)
}

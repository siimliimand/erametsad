// Seed data stores bare species codes ('ma', 'ku', …) and no label
// taxonomy exists in the repo, so every display form of a species
// derives from this one table: filter chips show "Name (CODE)" while
// the lot card needs the plain Estonian name.

export const SPECIES = [
  { value: 'ma', code: 'MA', name: 'Mänd' },
  { value: 'ku', code: 'KU', name: 'Kuusk' },
  { value: 'ks', code: 'KS', name: 'Kask' },
  { value: 'ha', code: 'HA', name: 'Haab' },
  { value: 'sa', code: 'SA', name: 'Sanglepp' },
  { value: 'ta', code: 'TA', name: 'Tamm' },
] as const

export type SpeciesCode = (typeof SPECIES)[number]['value']

/**
 * Display names for species codes, in input order. Unknown codes pass
 * through verbatim so stored data is never silently dropped.
 */
export function speciesNames(codes: string[]): string[] {
  return codes.map((code) => SPECIES.find((species) => species.value === code)?.name ?? code)
}

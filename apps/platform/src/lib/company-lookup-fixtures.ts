export interface CompanyFixture {
  regCode: string
  name: string
  boardMembers: { name: string; role: string }[]
}

export const COMPANY_FIXTURES: CompanyFixture[] = [
  {
    regCode: '12345678',
    name: 'Metsatark OÜ',
    boardMembers: [
      { name: 'Jaan Tamm', role: 'Juhatuse liige' },
      { name: 'Mari Mets', role: 'Juhatuse liige' },
    ],
  },
  {
    regCode: '23456789',
    name: 'Eramets AS',
    boardMembers: [
      { name: 'Peeter Kask', role: 'Juhatuse esimees' },
    ],
  },
  {
    regCode: '34567890',
    name: 'Metsaühistu Põhja-Talu',
    boardMembers: [
      { name: 'Andres Kuusk', role: 'Juhatuse liige' },
      { name: 'Kadri Leht', role: 'Juhatuse liige' },
      { name: 'Toomas Saar', role: 'Juhatuse liige' },
    ],
  },
  {
    regCode: '45678901',
    name: 'Puidukoda OÜ',
    boardMembers: [
      { name: 'Laura Mänd', role: 'Juhatuse liige' },
    ],
  },
  {
    regCode: '56789012',
    name: 'Metsataristu AS',
    boardMembers: [
      { name: 'Mati Raud', role: 'Juhatuse esimees' },
      { name: 'Kati Paju', role: 'Juhatuse liige' },
    ],
  },
  {
    regCode: '67890123',
    name: 'Rohemets OÜ',
    boardMembers: [
      { name: 'Sander Vaher', role: 'Juhatuse liige' },
    ],
  },
]

export function lookupCompany(regCode: string): CompanyFixture | null {
  return COMPANY_FIXTURES.find((c) => c.regCode === regCode) ?? null
}
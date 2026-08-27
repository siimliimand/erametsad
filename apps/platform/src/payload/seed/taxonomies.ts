import type { Payload } from 'payload'

const COUNTIES = [
  { name: 'Harju', code: 'HH' },
  { name: 'Hiiu', code: 'HI' },
  { name: 'Ida-Viru', code: 'IV' },
  { name: 'Jõgeva', code: 'JG' },
  { name: 'Järva', code: 'JR' },
  { name: 'Lääne', code: 'LN' },
  { name: 'Lääne-Viru', code: 'LV' },
  { name: 'Põlva', code: 'PL' },
  { name: 'Pärnu', code: 'PR' },
  { name: 'Rapla', code: 'RA' },
  { name: 'Saare', code: 'SR' },
  { name: 'Tartu', code: 'TA' },
  { name: 'Valga', code: 'VG' },
  { name: 'Viljandi', code: 'VR' },
  { name: 'Võru', code: 'VO' },
]

type CountyDoc = { id: string; name: string; code: string }

const PARISHES: Array<{ name: string; code?: string; countyCode: string }> = [
  { name: 'Anija', countyCode: 'HH' },
  { name: 'Harku', countyCode: 'HH' },
  { name: 'Jõelähtme', countyCode: 'HH' },
  { name: 'Keila', countyCode: 'HH' },
  { name: 'Kiili', countyCode: 'HH' },
  { name: 'Kose', countyCode: 'HH' },
  { name: 'Kuusalu', countyCode: 'HH' },
  { name: 'Raasiku', countyCode: 'HH' },
  { name: 'Rae', countyCode: 'HH' },
  { name: 'Saku', countyCode: 'HH' },
  { name: 'Saue', countyCode: 'HH' },
  { name: 'Viimsi', countyCode: 'HH' },
  { name: 'Hiiumaa', countyCode: 'HI' },
  { name: 'Alutaguse', countyCode: 'IV' },
  { name: 'Jõhvi', countyCode: 'IV' },
  { name: 'Lüganuse', countyCode: 'IV' },
  { name: 'Narva-Jõesuu', countyCode: 'IV' },
  { name: 'Toila', countyCode: 'IV' },
  { name: 'Jõgeva', countyCode: 'JG' },
  { name: 'Mustvee', countyCode: 'JG' },
  { name: 'Põltsamaa', countyCode: 'JG' },
  { name: 'Järva', countyCode: 'JR' },
  { name: 'Paide', countyCode: 'JR' },
  { name: 'Türi', countyCode: 'JR' },
  { name: 'Haapsalu', countyCode: 'LN' },
  { name: 'Lääne-Nigula', countyCode: 'LN' },
  { name: 'Vormsi', countyCode: 'LN' },
  { name: 'Haljala', countyCode: 'LV' },
  { name: 'Kadrina', countyCode: 'LV' },
  { name: 'Rakvere', countyCode: 'LV' },
  { name: 'Tapa', countyCode: 'LV' },
  { name: 'Vinni', countyCode: 'LV' },
  { name: 'Viru-Nigula', countyCode: 'LV' },
  { name: 'Väike-Maarja', countyCode: 'LV' },
  { name: 'Kanepi', countyCode: 'PL' },
  { name: 'Põlva', countyCode: 'PL' },
  { name: 'Räpina', countyCode: 'PL' },
  { name: 'Häädemeeste', countyCode: 'PR' },
  { name: 'Kihnu', countyCode: 'PR' },
  { name: 'Lääneranna', countyCode: 'PR' },
  { name: 'Põhja-Pärnumaa', countyCode: 'PR' },
  { name: 'Saarde', countyCode: 'PR' },
  { name: 'Tori', countyCode: 'PR' },
  { name: 'Kehtna', countyCode: 'RA' },
  { name: 'Kohila', countyCode: 'RA' },
  { name: 'Märjamaa', countyCode: 'RA' },
  { name: 'Rapla', countyCode: 'RA' },
  { name: 'Muhu', countyCode: 'SR' },
  { name: 'Ruhnu', countyCode: 'SR' },
  { name: 'Saaremaa', countyCode: 'SR' },
  { name: 'Elva', countyCode: 'TA' },
  { name: 'Kambja', countyCode: 'TA' },
  { name: 'Kastre', countyCode: 'TA' },
  { name: 'Luunja', countyCode: 'TA' },
  { name: 'Nõo', countyCode: 'TA' },
  { name: 'Peipsiääre', countyCode: 'TA' },
  { name: 'Tartu', countyCode: 'TA' },
  { name: 'Otepää', countyCode: 'VG' },
  { name: 'Tõrva', countyCode: 'VG' },
  { name: 'Valga', countyCode: 'VG' },
  { name: 'Mulgi', countyCode: 'VR' },
  { name: 'Põhja-Sakala', countyCode: 'VR' },
  { name: 'Viljandi', countyCode: 'VR' },
  { name: 'Antsla', countyCode: 'VO' },
  { name: 'Rõuge', countyCode: 'VO' },
  { name: 'Setomaa', countyCode: 'VO' },
  { name: 'Võru', countyCode: 'VO' },
  { name: 'Võru vald', countyCode: 'VO' },
]

export async function seedTaxonomies(payload: Payload): Promise<void> {
  const existing = await payload.find({ collection: 'counties', limit: 1 })
  if (existing.totalDocs > 0) {
    console.log('Counties already seeded, skipping')
    return
  }

  const countyMap = new Map<string, CountyDoc>()

  for (const county of COUNTIES) {
    const doc = await payload.create({
      collection: 'counties',
      data: county,
    })
    countyMap.set(county.code, doc as CountyDoc)
  }

  for (const parish of PARISHES) {
    const county = countyMap.get(parish.countyCode)
    if (!county) {
      console.warn(`Skipping parish "${parish.name}": unknown county code "${parish.countyCode}"`)
      continue
    }
    await payload.create({
      collection: 'parishes',
      data: {
        name: parish.name,
        code: parish.code ?? undefined,
        county: county.id,
      },
    })
  }

  console.log(`Seeded ${COUNTIES.length} counties and ${PARISHES.length} parishes`)
}
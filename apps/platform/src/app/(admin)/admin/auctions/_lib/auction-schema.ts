import { z } from 'zod'

import { eurosToCents } from '@/lib/data/repositories/money'
import { auctionObjectTypes } from '@/lib/data/schema'

/**
 * Validation for the full lot model behind the seven-step editor
 * (docs/design/admin/03). The schema speaks EUR + booleans; the write-data
 * conversion maps to the integer-cents repository columns.
 */

export const CADASTRE_PATTERN = /^\d{5}:\d{3}:\d{4}$/

/** Puuliigid, fixed codes from docs/design/admin/03 step 3. */
export const speciesCodes = [
  'MA', 'KU', 'NU', 'LH', 'SD', 'TS', 'TA', 'SA', 'VA', 'JA', 'KP', 'KS', 'HB',
  'LM', 'LV', 'PN', 'PP', 'PA', 'SP', 'PK', 'TY', 'KL', 'KD', 'RE', 'TM', 'PI',
] as const

/** Raieliigid, fixed codes from docs/design/admin/03 step 3. */
export const loggingTypeCodes = ['AR', 'HL', 'HR', 'KR', 'LR', 'RD', 'SR', 'TR', 'VE', 'VR'] as const

/** Anti-snipe per-lot bounds; the Settings default feeds the editor UI. */
export const ANTI_SNIPE_MIN_MINUTES = 1
export const ANTI_SNIPE_MAX_MINUTES = 30

const eurAmount = z
  .number({ invalid_type_error: 'Sisesta summa numbrina.' })
  .finite('Sisesta summa numbrina.')
  .min(0, 'Summa ei tohi olla negatiivne.')
  .max(1e13, 'Summa ületab lubatud maksimumi.')

const isoDatetime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Vigane kuupäev või aeg.')

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Kuupäeva vorming peab olema PP.KK.AAAA.')

export const mediaItemSchema = z.object({
  url: z.string().min(1, 'Pildi URL on kohustuslik.'),
  alt: z.string().max(500, 'Alternatiivtekst on liiga pikk.').default(''),
  focalX: z.number().min(0).max(1).optional(),
  focalY: z.number().min(0).max(1).optional(),
})

export const fileItemSchema = z.object({
  url: z.string().min(1, 'Faili URL on kohustuslik.'),
  tag: z.enum(['takseer', 'metsateatised', 'muu']).default('muu'),
})

export const packageRowSchema = z.object({
  cadastre: z
    .string()
    .regex(CADASTRE_PATTERN, 'Katastritunnuse vorming peab olema NNNNN:NNN:NNNN.'),
  registryNumber: z.string().regex(/^\d+$/, 'Kinnistu registri number peab olema numbriline.').optional(),
  county: z.string().optional(),
  areaHa: z.number().positive('Pindala peab olema positiivne.').optional(),
  minBidEur: eurAmount.optional(),
})

export const deadlinesSchema = z.object({
  loggingDeadline: dateOnly.optional(),
  removalDeadline: dateOnly.optional(),
  leaseDeadline: dateOnly.optional(),
  antiSnipeEnabled: z.boolean().optional(),
  antiSnipeMinutes: z
    .number()
    .int('Anti-snipe minutid peavad olema täisarv.')
    .min(ANTI_SNIPE_MIN_MINUTES, `Anti-snipe vähemalt ${String(ANTI_SNIPE_MIN_MINUTES)} minutit.`)
    .max(ANTI_SNIPE_MAX_MINUTES, `Anti-snipe kuni ${String(ANTI_SNIPE_MAX_MINUTES)} minutit.`)
    .optional(),
})

export const auctionInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Pealkiri on kohustuslik.').max(300, 'Pealkiri on liiga pikk.'),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'URL-nimi tohib sisaldada ainult väiketähti, numbreid ja sidekriipse.')
      .optional(),
    objectType: z.enum(auctionObjectTypes, { errorMap: () => ({ message: 'Vali sobiv objekti tüüp.' }) }),
    auctionType: z.enum(['open', 'sealed'], { errorMap: () => ({ message: 'Vali oksjoni tüüp.' }) }),
    isQuickAuction: z.boolean().default(false),
    antiSnipeEnabled: z.boolean().default(false),
    antiSnipeMinutes: z
      .number()
      .int('Anti-snipe minutid peavad olema täisarv.')
      .min(ANTI_SNIPE_MIN_MINUTES, `Anti-snipe vähemalt ${String(ANTI_SNIPE_MIN_MINUTES)} minutit.`)
      .max(ANTI_SNIPE_MAX_MINUTES, `Anti-snipe kuni ${String(ANTI_SNIPE_MAX_MINUTES)} minutit.`)
      .optional(),
    startsAt: isoDatetime.optional(),
    endsAt: isoDatetime.optional(),
    minBidEur: eurAmount.optional(),
    bidStepEur: eurAmount.optional(),
    // Write-only (design D5): accepted on write, never read back; the
    // conversion records only the fact of a change in audit diffs.
    reservePriceEur: eurAmount.optional(),
    feeOverridePercent: z
      .number()
      .int('Teenustasu ülekaal peab olema täisarv protsentides.')
      .min(0, 'Teenustasu ülekaal ei tohi olla negatiivne.')
      .max(100, 'Teenustasu ülekaal kuni 100%.')
      .optional(),
    countyId: z.string().trim().max(100).optional(),
    parishId: z.string().trim().max(100).optional(),
    address: z.string().trim().max(500).optional(),
    coordinates: z
      .object({
        lat: z.number().min(-90).max(90, 'Laiuskraad vahemikus -90..90.'),
        lng: z.number().min(-180).max(180, 'Pikkuskraad vahemikus -180..180.'),
      })
      .optional(),
    areaHa: z.number().positive('Pindala peab olema positiivne.').max(10000, 'Pindala kuni 10 000 ha.').optional(),
    volumeM3: z.number().positive('Raiemahu peab olema positiivne.').optional(),
    cadastres: z
      .array(
        z.string().regex(CADASTRE_PATTERN, 'Katastritunnuse vorming peab olema NNNNN:NNN:NNNN (nt 34801:001:0217).'),
      )
      .default([]),
    registryNumbers: z
      .array(z.string().regex(/^\d+$/, 'Kinnistu registri number peab olema numbriline.'))
      .default([]),
    species: z.array(z.enum(speciesCodes)).default([]),
    loggingTypes: z.array(z.enum(loggingTypeCodes)).default([]),
    compartments: z.array(z.string().trim().min(1, 'Eraldis ei tohi olla tühi.')).default([]),
    forestNotifications: z
      .array(z.string().regex(/^\d{8,12}$/, 'Metsateatise number peab olema 8–12 numbrit.'))
      .default([]),
    deadlines: deadlinesSchema.default({}),
    descriptionPublic: z.string().max(20000, 'Avalik info kuni 20 000 tähemärki.').optional(),
    descriptionInternal: z.string().max(20000, 'Sisemine info kuni 20 000 tähemärki.').optional(),
    descriptionSecondary: z.string().max(20000, 'Täiendav info kuni 20 000 tähemärki.').optional(),
    aliasEmail: z.string().email('Vigane e-posti aadress.').optional(),
    specialistId: z.string().trim().optional(),
    media: z.array(mediaItemSchema).default([]),
    files: z.array(fileItemSchema).default([]),
    propertyCount: z.number().int('Kinnistute arv peab olema täisarv.').min(2, 'Paketis peab olema vähemalt kaks kinnistut.').optional(),
    packageHeader: z.string().max(20000).optional(),
    packageRows: z.array(packageRowSchema).default([]),
  })
  .superRefine((data, ctx) => {
    const addIssue = (path: string, message: string): void => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })
    }

    // Sealed is a hard rule for property and package lots; the editor may
    // not override it (docs 03 step 1).
    if ((data.objectType === 'kinnistu' || data.objectType === 'pakett') && data.auctionType !== 'sealed') {
      addIssue('auctionType', 'Kinnistu ja pakett müüakse ainult pimepakkumisega (suletud oksjon).')
    }

    // A quick auction (kiiroksjon) is always open bidding with its own window.
    if (data.isQuickAuction && data.auctionType !== 'open') {
      addIssue('auctionType', 'Kiiroksjon on avatud tõusev oksjon.')
    }

    if (data.auctionType === 'open') {
      if (data.bidStepEur === undefined || data.bidStepEur < 1) {
        addIssue('bidStepEur', 'Avatud oksjonil on pakkumise samm kohustuslik (vähemalt 1 €).')
      }
    } else if (data.bidStepEur !== undefined) {
      addIssue('bidStepEur', 'Suletud oksjonil ei ole pakkumise sammu.')
    }

    if (!data.isQuickAuction && data.minBidEur === undefined) {
      addIssue('minBidEur', 'Alghind on kohustuslik.')
    }

    if (data.startsAt && data.endsAt) {
      const durationMs = Date.parse(data.endsAt) - Date.parse(data.startsAt)
      if (durationMs <= 0) {
        addIssue('endsAt', 'Lõppaeg peab olema pärast algusaega.')
      } else {
        if (durationMs < 60 * 60 * 1000) {
          addIssue('endsAt', 'Lõpp peab olema vähemalt 1 tund pärast algust.')
        }
        if (durationMs > 90 * 24 * 60 * 60 * 1000) {
          addIssue('endsAt', 'Oksjoni maksimaalne kestus on 90 päeva.')
        }
        if (data.isQuickAuction && (durationMs < 24 * 60 * 60 * 1000 || durationMs > 72 * 60 * 60 * 1000)) {
          addIssue('endsAt', 'Kiiroksjoni kestus peab olema 24–72 tundi.')
        }
      }
    }

    if (data.isQuickAuction && data.reservePriceEur === undefined) {
      addIssue('reservePriceEur', 'Kiiroksjonil on piirhind kohustuslik.')
    }

    if (data.objectType === 'raieoigus' && data.volumeM3 === undefined) {
      addIssue('volumeM3', 'Raiemahu on raieõiguse oksjonil kohustuslik.')
    }

    if (data.antiSnipeEnabled && data.antiSnipeMinutes === undefined) {
      addIssue('antiSnipeMinutes', 'Määra automaatse pikenduse minutid (1–30).')
    }

    if (data.objectType === 'pakett' && data.propertyCount === undefined) {
      addIssue('propertyCount', 'Sisesta paketi kinnistute arv.')
    }
  })

export type AuctionInput = z.infer<typeof auctionInputSchema>

/**
 * Coercions the wizard relies on: a lot of objectType 'kiire' is always a
 * kiiroksjon, and a kiiroksjon starts at €1 unless the operator raises it.
 */
export function applyQuickAuctionDefaults(input: AuctionInput): AuctionInput {
  const isQuick = input.isQuickAuction || input.objectType === 'kiire'
  return {
    ...input,
    isQuickAuction: isQuick,
    minBidEur: isQuick && input.minBidEur === undefined ? 1 : input.minBidEur,
  }
}

export interface AuctionWriteData {
  title: string
  slug?: string
  objectType: (typeof auctionObjectTypes)[number]
  type: 'open' | 'sealed'
  isQuickAuction: boolean
  minBidCents: number
  bidStepCents?: number | null
  reservePriceCents?: number
  feeOverridePercent?: number
  startsAt?: string | null
  endsAt?: string | null
  countyId?: string
  parishId?: string
  address?: string | null
  coordinates?: unknown
  cadastres: string[]
  registryNumbers: string[]
  species: string[]
  loggingTypes: string[]
  compartments: string[]
  notifications: string[]
  deadlines: unknown
  descriptionPublic?: string | null
  descriptionInternal?: string | null
  descriptionSecondary?: string | null
  aliasEmail?: string | null
  specialistId?: string
  media: unknown[]
  files: unknown[]
  packageHeader?: string
  packageRows: unknown[]
  packageColumns?: string[]
}

/**
 * Maps validated EUR input onto the integer-cents repository columns
 * (money helpers are the only sanctioned EUR→cents boundary).
 */
export function toAuctionWriteData(input: AuctionInput): AuctionWriteData {
  const minBidEur = input.minBidEur ?? (input.isQuickAuction ? 1 : 0)
  return {
    title: input.title,
    ...(input.slug !== undefined ? { slug: input.slug } : {}),
    objectType: input.objectType,
    type: input.auctionType,
    isQuickAuction: input.isQuickAuction,
    minBidCents: eurosToCents(minBidEur),
    bidStepCents: input.bidStepEur !== undefined ? eurosToCents(input.bidStepEur) : null,
    ...(input.reservePriceEur !== undefined
      ? { reservePriceCents: eurosToCents(input.reservePriceEur) }
      : {}),
    ...(input.feeOverridePercent !== undefined ? { feeOverridePercent: input.feeOverridePercent } : {}),
    ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
    ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
    // No dedicated county/parish columns exist on the wizard input until a
    // migration adds FKs; empty strings stay absent so the publish gate
    // (not the draft save) blocks them.
    ...(input.countyId ? { countyId: input.countyId } : {}),
    ...(input.parishId ? { parishId: input.parishId } : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.coordinates !== undefined ? { coordinates: input.coordinates } : {}),
    cadastres: input.cadastres,
    registryNumbers: input.registryNumbers,
    species: [...input.species],
    loggingTypes: [...input.loggingTypes],
    compartments: input.compartments,
    notifications: input.forestNotifications,
    deadlines: {
      ...input.deadlines,
      antiSnipeEnabled: input.antiSnipeEnabled,
      ...(input.antiSnipeMinutes !== undefined ? { antiSnipeMinutes: input.antiSnipeMinutes } : {}),
      // The auctions table has no propertyCount/areaHa/volumeM3 columns yet;
      // these scalars ride in the structured JSON until a migration adds
      // them. Row-level area/volume totals keep coming from packageRows.
      ...(input.propertyCount !== undefined ? { propertyCount: input.propertyCount } : {}),
      ...(input.areaHa !== undefined ? { areaHa: input.areaHa } : {}),
      ...(input.volumeM3 !== undefined ? { volumeM3: input.volumeM3 } : {}),
    },
    ...(input.descriptionPublic !== undefined ? { descriptionPublic: input.descriptionPublic } : {}),
    ...(input.descriptionInternal !== undefined ? { descriptionInternal: input.descriptionInternal } : {}),
    ...(input.descriptionSecondary !== undefined ? { descriptionSecondary: input.descriptionSecondary } : {}),
    ...(input.aliasEmail !== undefined ? { aliasEmail: input.aliasEmail } : {}),
    ...(input.specialistId !== undefined && input.specialistId !== '' ? { specialistId: input.specialistId } : {}),
    media: [...input.media],
    files: [...input.files],
    ...(input.packageHeader !== undefined ? { packageHeader: input.packageHeader } : {}),
    packageRows: [...input.packageRows],
    ...(input.objectType === 'pakett'
      ? { packageColumns: ['Katastritunnus', 'Kinnistu nr', 'Maakond', 'Pindala ha', 'Alghind €'] }
      : {}),
  }
}

const ESTONIAN_CHAR_MAP: Record<string, string> = {
  ä: 'a', ö: 'o', ü: 'u', õ: 'o', š: 's', ž: 'z',
}

export function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[äöüõšž]/g, (char) => ESTONIAN_CHAR_MAP[char] ?? char)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
  return base === '' ? 'oksjon' : base
}

/** Publish gates evaluated against the stored row (secret values excluded). */
export interface AuctionGateSubject {
  objectType: string
  type: string
  isQuickAuction: boolean
  startsAt: string | null
  endsAt: string | null
  minBidCents: number
  reservePriceCents: number | null
  cadastres: unknown
  countyId: string | null
  parishId: string | null
  packageRows: unknown
  media: unknown
}

const AREA_KEYS = ['area', 'ha', 'areaHa', 'area_ha'] as const
const VOLUME_KEYS = ['volume', 'volumeM3', 'volume_m3', 'm3'] as const

function extractNumberTotal(rows: unknown, keys: readonly string[]): number | null {
  if (!Array.isArray(rows)) return null
  let total = 0
  let seen = false
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const record = row as Record<string, unknown>
    for (const key of keys) {
      const value = record[key]
      const numeric = typeof value === 'number' ? value : Number(value)
      if (Number.isFinite(numeric)) {
        total += numeric
        seen = true
        break
      }
    }
  }
  return seen ? total : null
}

export interface PublishGateFailure {
  step: string
  field: string
  message: string
}

/**
 * Blocking gates enforce the mechanics the schema owns (type, times,
 * location, cadastres, kiiroksjon rules). Media gates block only when the
 * lot already carries media rows so legacy lots without media still
 * publish; the wizard turns the warning into a hard gate.
 */
export function collectPublishGateFailures(subject: AuctionGateSubject): {
  blocking: PublishGateFailure[]
  warnings: PublishGateFailure[]
} {
  const blocking: PublishGateFailure[] = []
  const warnings: PublishGateFailure[] = []

  if ((subject.objectType === 'kinnistu' || subject.objectType === 'pakett') && subject.type !== 'sealed') {
    blocking.push({
      step: 'Tüüp ja mehaanika',
      field: 'auctionType',
      message: 'Kinnistu ja pakett müüakse ainult pimepakkumisega.',
    })
  }

  if (!subject.startsAt || !subject.endsAt) {
    blocking.push({ step: 'Tüüp ja mehaanika', field: 'startsAt', message: 'Määra oksjonile algus- ja lõppaeg.' })
  } else {
    const durationMs = Date.parse(subject.endsAt) - Date.parse(subject.startsAt)
    if (durationMs <= 0) {
      blocking.push({ step: 'Tüüp ja mehaanika', field: 'endsAt', message: 'Lõppaeg peab olema pärast algusaega.' })
    } else {
      if (durationMs < 60 * 60 * 1000) {
        blocking.push({ step: 'Tüüp ja mehaanika', field: 'endsAt', message: 'Lõpp peab olema vähemalt 1 tund pärast algust.' })
      }
      if (durationMs > 90 * 24 * 60 * 60 * 1000) {
        blocking.push({ step: 'Tüüp ja mehaanika', field: 'endsAt', message: 'Oksjoni maksimaalne kestus on 90 päeva.' })
      }
      if (
        subject.isQuickAuction &&
        (durationMs < 24 * 60 * 60 * 1000 || durationMs > 72 * 60 * 60 * 1000)
      ) {
        blocking.push({ step: 'Tüüp ja mehaanika', field: 'endsAt', message: 'Kiiroksjoni kestus peab olema 24–72 tundi.' })
      }
    }
  }

  if (subject.isQuickAuction && subject.reservePriceCents === null) {
    blocking.push({ step: 'Hind', field: 'reservePrice', message: 'Kiiroksjonil on piirhind kohustuslik.' })
  }

  if (subject.minBidCents < 0) {
    blocking.push({ step: 'Hind', field: 'minBid', message: 'Alghind ei tohi olla negatiivne.' })
  }

  if (!subject.countyId || !subject.parishId) {
    blocking.push({ step: 'Asukoht', field: 'countyId', message: 'Vali maakond ja vald.' })
  }

  const cadastres = Array.isArray(subject.cadastres) ? (subject.cadastres as unknown[]) : []
  if (cadastres.length === 0) {
    blocking.push({ step: 'Maa ja mets', field: 'cadastres', message: 'Lisa vähemalt üks katastritunnus.' })
  } else {
    const invalid = cadastres.find(
      (value): value is string => typeof value === 'string' && !CADASTRE_PATTERN.test(value),
    )
    if (invalid !== undefined) {
      blocking.push({
        step: 'Maa ja mets',
        field: 'cadastres',
        message: `Katastritunnuse vorming peab olema NNNNN:NNN:NNNN (vigane: ${invalid}).`,
      })
    }
  }

  if (subject.objectType === 'raieoigus') {
    const volume = extractNumberTotal(subject.packageRows, VOLUME_KEYS)
    if (volume === null || volume <= 0) {
      blocking.push({ step: 'Maa ja mets', field: 'volumeM3', message: 'Raiemahu on raieõiguse oksjonil kohustuslik.' })
    }
  }
  const area = extractNumberTotal(subject.packageRows, AREA_KEYS)
  if (area === null || area <= 0) {
    warnings.push({ step: 'Maa ja mets', field: 'areaHa', message: 'Pindala (ha) on lisamata.' })
  }

  const media = Array.isArray(subject.media) ? (subject.media as { alt?: string }[]) : []
  if (media.length === 0) {
    warnings.push({ step: 'Sisu', field: 'media', message: 'Hero pilt on lisamata.' })
  } else {
    const missingAlt = media.findIndex((item) => !item.alt || item.alt.trim() === '')
    if (missingAlt >= 0) {
      blocking.push({
        step: 'Sisu',
        field: `media[${String(missingAlt)}].alt`,
        message: `Pildil ${String(missingAlt + 1)} puudub alternatiivtekst.`,
      })
    }
  }

  return { blocking, warnings }
}

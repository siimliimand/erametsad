'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminRepositories } from '../_lib/admin'

import { auctionObjectTypes } from '@/lib/data/schema'

const newAuctionPath = '/admin/auctions/new'

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function readOptionalDatetime(formData: FormData, key: string): string | null {
  const value = readText(formData, key)
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?viga=${encodeURIComponent(message)}`)
}

export async function createAuctionAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const title = readText(formData, 'title')
  const slug = readText(formData, 'slug')
  const objectType = readText(formData, 'objectType')
  const type = readText(formData, 'type') === 'sealed' ? ('sealed' as const) : ('open' as const)
  const minBidEur = Number(readText(formData, 'minBidEur').replace(',', '.'))
  const bidStepText = readText(formData, 'bidStepEur').replace(',', '.')
  const bidStepEur = bidStepText === '' ? null : Number(bidStepText)

  if (!title) redirectWithError(newAuctionPath, 'Pealkiri on kohustuslik.')
  if (!slug) redirectWithError(newAuctionPath, 'URL-nimi on kohustuslik.')
  if (!auctionObjectTypes.includes(objectType as (typeof auctionObjectTypes)[number])) {
    redirectWithError(newAuctionPath, 'Vali sobiv objekti tüüp.')
  }
  if (!Number.isFinite(minBidEur) || minBidEur < 0) {
    redirectWithError(newAuctionPath, 'Lähtehind peab olema mitte negatiivne number.')
  }
  if (bidStepEur !== null && (!Number.isFinite(bidStepEur) || bidStepEur < 0)) {
    redirectWithError(newAuctionPath, 'Pakkumise samm peab olema mitte negatiivne number.')
  }

  let failure: string | null = null
  try {
    await repositories.create({
      collection: 'auctions',
      data: {
        title,
        slug,
        status: 'draft',
        objectType: objectType as (typeof auctionObjectTypes)[number],
        type,
        minBidCents: Math.round(minBidEur * 100),
        ...(bidStepEur !== null ? { bidStepCents: Math.round(bidStepEur * 100) } : {}),
        startsAt: readOptionalDatetime(formData, 'startsAt'),
        endsAt: readOptionalDatetime(formData, 'endsAt'),
        descriptionPublic: readText(formData, 'descriptionPublic') || null,
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(newAuctionPath, `Oksjoni loomine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/auctions')
  redirect('/admin/auctions')
}

export async function deleteAuctionAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError('/admin/auctions', 'Kustutamiseks puudub oksjoni identifikaator.')

  let failure: string | null = null
  try {
    await repositories.delete({ collection: 'auctions', id })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError('/admin/auctions', `Oksjoni kustutamine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/auctions')
  redirect('/admin/auctions')
}

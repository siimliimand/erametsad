'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminRepositories } from '../_lib/admin'

import { userRoles, userStatuses } from '@/lib/data/schema'

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?viga=${encodeURIComponent(message)}`)
}

export async function updateUserAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) redirectWithError('/admin/users', 'Kasutaja identifikaator puudub.')

  const editPath = `/admin/users/${id}`
  const role = readText(formData, 'role')
  const status = readText(formData, 'status')

  if (!userRoles.includes(role as (typeof userRoles)[number]) || role === 'guest') {
    redirectWithError(editPath, 'Vali sobiv roll.')
  }
  if (!userStatuses.includes(status as (typeof userStatuses)[number])) {
    redirectWithError(editPath, 'Vali sobiv olek.')
  }

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'users',
      id,
      data: {
        role,
        status,
        name: readText(formData, 'name') || null,
        phone: readText(formData, 'phone') || null,
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(editPath, `Kasutaja salvestamine ebaõnnestus: ${failure}`)
  }

  revalidatePath('/admin/users')
  revalidatePath(editPath)
  redirect('/admin/users')
}

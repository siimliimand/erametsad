'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminRepositories } from '../_lib/admin'

import { contractStatuses } from '@/lib/data/schema'

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?viga=${encodeURIComponent(message)}`)
}

// Mirrors src/lib/contracts/service.ts: prepared -> sent -> signed, void is
// only legal before signing, signed and voided are terminal.
const allowedTransitions: Record<string, readonly string[]> = {
  prepared: ['sent', 'signed', 'voided'],
  sent: ['signed', 'voided'],
  signed: [],
  voided: [],
}

export async function updateContractStatusAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  const status = readText(formData, 'status')
  const listPath = '/admin/contracts'
  const editPath = `/admin/contracts/${id}`

  if (!id) redirectWithError(listPath, 'Lepingu identifikaator puudub.')
  if (!contractStatuses.includes(status as (typeof contractStatuses)[number])) {
    redirectWithError(editPath, 'Vali sobiv lepingu olek.')
  }

  const contract = await repositories.findByID({ collection: 'contracts', id })
  if (!contract) redirectWithError(listPath, 'Lepingut ei leitud.')

  if (!allowedTransitions[contract.status]?.includes(status)) {
    redirectWithError(
      editPath,
      `Üleminek olekusse "${status}" pole lubatud praegusest olekust "${contract.status}".`,
    )
  }

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'contracts',
      id,
      data: {
        status,
        ...(status === 'signed' ? { signedAt: new Date().toISOString() } : {}),
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(editPath, `Lepingu oleku muutmine ebaõnnestus: ${failure}`)
  }

  revalidatePath(listPath)
  revalidatePath(editPath)
  redirect(editPath)
}

export async function setTemplateActiveAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  const active = readText(formData, 'active') === 'true'
  const templatesPath = '/admin/contracts/templates'

  if (!id) redirectWithError(templatesPath, 'Malli identifikaator puudub.')

  let failure: string | null = null
  try {
    // The repository hook keeps one active template per type on activation.
    await repositories.update({
      collection: 'contract-templates',
      id,
      data: { active },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(templatesPath, `Malli muutmine ebaõnnestus: ${failure}`)
  }

  revalidatePath(templatesPath)
  revalidatePath('/admin/contracts')
  redirect(templatesPath)
}

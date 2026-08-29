'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminRepositories } from '../_lib/admin'

import { leadStatuses } from '@/lib/data/schema'

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?viga=${encodeURIComponent(message)}`)
}

export async function updateLeadAction(formData: FormData): Promise<void> {
  const { repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  const status = readText(formData, 'status')
  const assignedSpecialist = readText(formData, 'assignedSpecialist')
  const listPath = '/admin/leads'
  const editPath = `/admin/leads/${id}`

  if (!id) redirectWithError(listPath, 'Juhi identifikaator puudub.')
  if (!leadStatuses.includes(status as (typeof leadStatuses)[number])) {
    redirectWithError(editPath, 'Vali sobiv olek.')
  }

  if (assignedSpecialist) {
    const specialist = await repositories.findByID({
      collection: 'specialists',
      id: assignedSpecialist,
    })
    if (!specialist) redirectWithError(editPath, 'Määratud spetsialisti ei leitud.')
  }

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'leads',
      id,
      data: {
        status,
        assignedSpecialist: assignedSpecialist || null,
        internalComment: readText(formData, 'internalComment') || null,
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(editPath, `Juhi salvestamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(listPath)
  revalidatePath(editPath)
  redirect(listPath)
}

export async function reviewCompanyAccessRequestAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  const decision = readText(formData, 'decision')
  const requestsPath = '/admin/leads/requests'

  if (!id) redirectWithError(requestsPath, 'Taotluse identifikaator puudub.')
  if (decision !== 'approve' && decision !== 'reject') {
    redirectWithError(requestsPath, 'Tundmatu otsus.')
  }

  const request = await repositories.findByID({ collection: 'company-access-request', id })
  if (!request) redirectWithError(requestsPath, 'Taotlust ei leitud.')
  if (request.status !== 'pending') {
    redirectWithError(requestsPath, 'Taotlus on juba läbi vaadatud.')
  }

  const reviewedAt = new Date().toISOString()
  const nextStatus = decision === 'approve' ? 'approved' : 'rejected'

  // Approval mirrors the register flow: the matching company profile leaves
  // the pending state so the account becomes usable (or stays blocked).
  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'company-access-request',
      id,
      data: { status: nextStatus, reviewedBy: session.userId, reviewedAt },
    })

    const { docs: matchingUsers } = await repositories.find({
      collection: 'users',
      where: { email: { equals: request.requesterEmail ?? '' } },
      limit: 1,
    })
    const user = matchingUsers[0]
    if (user) {
      const { docs: matchingProfiles } = await repositories.find({
        collection: 'profile',
        where: { user: { equals: user.id } },
        limit: 1,
      })
      const profile = matchingProfiles[0]
      if (profile?.approvalStatus === 'pending') {
        await repositories.update({
          collection: 'profile',
          id: profile.id,
          data: { approvalStatus: nextStatus === 'approved' ? 'approved' : 'rejected' },
        })
      }
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    redirectWithError(requestsPath, `Taotluse läbivaatamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(requestsPath)
  revalidatePath('/admin/leads')
  redirect(requestsPath)
}

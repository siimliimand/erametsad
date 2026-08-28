import { updateUserProfileId } from '@/lib/auth/session'
import { getRepositories } from '@/lib/data/runtime'

export async function selectActiveProfile(
  userId: string,
  profileId: string,
): Promise<string> {
  const repos = await getRepositories()

  const result = await repos.find({
    collection: 'profile',
    where: { id: { equals: profileId }, user: { equals: userId } },
    limit: 1,
  })

  if (!result.docs.length) {
    throw new Error('Profiili ei leitud')
  }

  await updateUserProfileId(userId, profileId)

  return profileId
}

export function getActiveProfileId(session: {
  profileId?: string | null
} | null): string | null {
  if (!session) return null
  return session.profileId ?? null
}
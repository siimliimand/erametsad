import { getPayloadClient } from '@/payload/payloadClient'

export async function checkContractGate(
  userId: string,
  _auctionId: string,
): Promise<{ passed: boolean; redirectUrl?: string }> {
  const payload = await getPayloadClient()

  const settingsResult = await payload.find({
    collection: 'settings',
    limit: 1,
    depth: 0,
  })

  const settings = settingsResult.docs[0] as Record<string, unknown> | undefined
  const featureFlags: Record<string, unknown> = settings?.featureFlags
    ? (settings.featureFlags as Record<string, unknown>)
    : {}
  const requireFrameworkContract = featureFlags.requireFrameworkContract === true

  if (!requireFrameworkContract) {
    return { passed: true }
  }

  const frameworkTemplates = await payload.find({
    collection: 'contract-templates',
    where: {
      and: [
        { type: { equals: 'framework' } },
        { active: { equals: true } },
      ],
    },
    limit: 100,
    depth: 0,
  })

  const templateIds = frameworkTemplates.docs.map(
    (t: Record<string, unknown>) => t.id,
  )

  if (templateIds.length === 0) {
    return { passed: true }
  }

  const signedContracts = await payload.find({
    collection: 'contracts',
    where: {
      and: [
        { signedBy: { equals: userId } },
        { status: { equals: 'signed' } },
        { template: { in: templateIds } },
      ],
    },
    limit: 1,
    depth: 0,
  })

  if (signedContracts.docs.length === 0) {
    return { passed: false, redirectUrl: '/contracts/framework' }
  }

  return { passed: true }
}
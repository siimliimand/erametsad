import type { ContractFlowSnapshot } from './contract-api'

import type { CoreRepositories } from '@/lib/data/repositories'
import type { Contract } from '@/lib/data/schema'

/**
 * Derives the server-side signing state for one contract kind. The signed
 * short-circuit matches ANY signed template version: the signature is bound
 * to the template row that was active at signing time, so a later version
 * bump never invalidates it (new versions apply to future contracts only).
 */
export async function loadContractSnapshot(
  repositories: CoreRepositories,
  kind: 'framework' | 'auction',
  auctionId: string | null,
  userId: string,
): Promise<ContractFlowSnapshot & { templateVersion: string | null }> {
  const templates = await repositories.find({
    collection: 'contract-templates',
    where: { type: { equals: kind } },
    pagination: false,
  })
  const templateIds = templates.docs.map((template) => template.id)
  if (templateIds.length === 0) {
    return {
      status: 'none',
      contractId: null,
      renderedHtml: null,
      signedAt: null,
      createdAt: null,
      updatedAt: null,
      templateVersion: null,
    }
  }

  const lotScope =
    kind === 'auction' && auctionId !== null
      ? [{ lot: { equals: auctionId } }]
      : []

  const signedResult = await repositories.find({
    collection: 'contracts',
    where: {
      and: [
        { template: { in: templateIds } },
        { status: { equals: 'signed' } },
        { signedBy: { equals: userId } },
        ...lotScope,
      ],
    },
    sort: '-createdAt',
    limit: 1,
  })
  const signed = signedResult.docs[0]
  if (signed) {
    return {
      status: 'signed',
      contractId: signed.id,
      renderedHtml: signed.renderedHtml,
      signedAt: signed.signedAt,
      createdAt: signed.createdAt,
      updatedAt: signed.updatedAt,
      templateVersion: await templateVersionOf(repositories, templates.docs, signed),
    }
  }

  const liveResult = await repositories.find({
    collection: 'contracts',
    where: {
      and: [
        { template: { in: templateIds } },
        { status: { in: ['prepared', 'sent'] } },
        { signedBy: { equals: userId } },
        ...lotScope,
      ],
    },
    sort: '-createdAt',
    limit: 1,
  })
  const live = liveResult.docs[0]
  if (live) {
    return {
      status: live.status,
      contractId: live.id,
      renderedHtml: live.renderedHtml,
      signedAt: null,
      createdAt: live.createdAt,
      updatedAt: live.updatedAt,
      templateVersion: await templateVersionOf(repositories, templates.docs, live),
    }
  }

  const voidedResult = await repositories.find({
    collection: 'contracts',
    where: {
      and: [{ template: { in: templateIds } }, { status: { equals: 'voided' } }, ...lotScope],
    },
    sort: '-createdAt',
    limit: 1,
  })
  const voided = voidedResult.docs[0]
  if (voided) {
    return {
      status: 'voided',
      contractId: voided.id,
      renderedHtml: voided.renderedHtml,
      signedAt: null,
      createdAt: voided.createdAt,
      updatedAt: voided.updatedAt,
      templateVersion: await templateVersionOf(repositories, templates.docs, voided),
    }
  }

  return {
    status: 'none',
    contractId: null,
    renderedHtml: null,
    signedAt: null,
    createdAt: null,
    updatedAt: null,
    templateVersion: null,
  }
}

async function templateVersionOf(
  repositories: CoreRepositories,
  templates: readonly { id: string; version: string }[],
  contract: Contract,
): Promise<string | null> {
  const own = templates.find((template) => template.id === contract.templateId)
  if (own) return own.version
  const template = await repositories.findByID({
    collection: 'contract-templates',
    id: contract.templateId,
  })
  return template?.version ?? null
}

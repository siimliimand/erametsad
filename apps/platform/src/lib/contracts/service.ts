import crypto from 'node:crypto'

import { renderTemplate } from './render'
import type { ContractTemplate } from './render'
import { getPayloadClient } from '../../payload/payloadClient'

export interface Contract {
  id: string
  template: string
  lot: string
  status: 'prepared' | 'sent' | 'signed' | 'voided'
  signedAt?: string | undefined
  signedBy?: string | undefined
  contentHash?: string | undefined
  renderedHtml?: string | undefined
}

const SIGNING_EXPIRY_MS = 15 * 60 * 1000

export async function prepareContract(
  auctionId: string,
  type: 'framework' | 'auction',
): Promise<Contract> {
  const payload = await getPayloadClient()

  const templateResult = await payload.find({
    collection: 'contract-templates',
    where: {
      and: [
        { type: { equals: type } },
        { active: { equals: true } },
      ],
    },
    limit: 1,
    depth: 0,
  })

  const templateDoc = templateResult.docs[0] as Record<string, unknown> | undefined
  if (!templateDoc) {
    throw new Error(`No active ${type} contract template found`)
  }

  const auctionResult = await payload.find({
    collection: 'auctions',
    where: { id: { equals: auctionId } },
    limit: 1,
    depth: 1,
  })
  const auction = auctionResult.docs[0] as Record<string, unknown> | undefined
  if (!auction) {
    throw new Error('Auction not found')
  }

  const placeholders = (templateDoc.placeholders as { key: string }[] | undefined) ?? []
  const data: Record<string, string> = {}
  for (const ph of placeholders) {
    const key = ph.key
    if (key.startsWith('auction.')) {
      const field = key.slice('auction.'.length)
      data[key] = (auction[field] as string | undefined) ?? ''
    } else {
      data[key] = `[${key}]`
    }
  }
  data.auctionTitle = (auction.title as string | undefined) ?? `Auction ${auctionId}`
  data.date = new Date().toISOString().split('T')[0] ?? ''
  data.auctionId = auctionId

  const template: ContractTemplate = {
    name: templateDoc.name as string,
    type: templateDoc.type as 'framework' | 'auction',
    version: templateDoc.version as string,
    placeholders,
    active: templateDoc.active as boolean,
    htmlContent: templateDoc.htmlContent as string | undefined,
  }

  const rendered = renderTemplate(template, data)

  const newContract = await payload.create({
    collection: 'contracts',
    data: {
      template: templateDoc.id,
      lot: auctionId,
      status: 'prepared',
      renderedHtml: rendered.html,
    },
  })

  return newContract as unknown as Contract
}

export async function signContract(
  contractId: string,
  signerId: string,
): Promise<Contract> {
  const payload = await getPayloadClient()

  const contractResult = await payload.find({
    collection: 'contracts',
    where: { id: { equals: contractId } },
    limit: 1,
    depth: 0,
  })
  const contract = contractResult.docs[0] as Record<string, unknown> | undefined
  if (!contract) {
    throw new Error('Contract not found')
  }

  if (contract.status !== 'prepared') {
    throw new Error(`Contract cannot be signed in status: ${String(contract.status)}`)
  }

  const createdAt = contract.createdAt as string
  const elapsed = Date.now() - new Date(createdAt).getTime()
  if (elapsed > SIGNING_EXPIRY_MS) {
    await payload.update({
      collection: 'contracts',
      id: contractId,
      data: { status: 'voided' },
    })
    throw new Error('Signing session expired (over 15 minutes)')
  }

  const renderedHtml = contract.renderedHtml as string | undefined
  const contentHash = crypto.createHash('sha256').update(renderedHtml ?? contractId).digest('hex')

  const updated = await payload.update({
    collection: 'contracts',
    id: contractId,
    data: {
      status: 'signed',
      signedAt: new Date().toISOString(),
      signedBy: signerId,
      contentHash,
    },
  })

  return updated as unknown as Contract
}

export async function voidContract(contractId: string): Promise<void> {
  const payload = await getPayloadClient()

  const contractResult = await payload.find({
    collection: 'contracts',
    where: { id: { equals: contractId } },
    limit: 1,
    depth: 0,
  })
  const contract = contractResult.docs[0] as Record<string, unknown> | undefined
  if (!contract) {
    throw new Error('Contract not found')
  }

  if (contract.status === 'signed') {
    throw new Error('Cannot void a signed contract')
  }

  await payload.update({
    collection: 'contracts',
    id: contractId,
    data: { status: 'voided' },
  })
}
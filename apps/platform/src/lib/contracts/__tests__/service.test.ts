import crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { prepareContract, signContract } from '../service'

import { getRepositories } from '@/lib/data/runtime'


const OWNER_ID = 'user-1'
const AUCTION_ID = 'auction-1'
const CONTRACT_ID = 'contract-1'
const RENDERED_HTML = '<p>Metsa ostu-müügleping</p>'

const activeTemplate = {
  id: 'template-1',
  name: 'Metsa ostu-müügleping',
  type: 'auction',
  version: '1.0.0',
  placeholders: [],
  active: true,
  htmlContent: '<p>{{auctionTitle}}</p>',
}

const auction = { id: AUCTION_ID, title: 'Testioksjon' }

function contractRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTRACT_ID,
    templateId: 'template-1',
    lotId: AUCTION_ID,
    status: 'prepared',
    signedAt: null,
    signedBy: OWNER_ID,
    contentHash: null,
    renderedHtml: RENDERED_HTML,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

let mockRepos: {
  find: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRepos = {
    find: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  }
  vi.mocked(getRepositories).mockImplementation(() => mockRepos as never)
})

// The service reads the collection name from each find call, so routing the
// mock by collection keeps the responses independent of call order.
function mockFindDocs(docsByCollection: Record<string, Record<string, unknown>[]>): void {
  mockRepos.find.mockImplementation((args: { collection: string }) => {
    return Promise.resolve({ docs: docsByCollection[args.collection] ?? [] })
  })
}

describe('prepareContract', () => {
  it('stores the preparing user as signedBy on the created contract row', async () => {
    const row = contractRow()
    mockFindDocs({ 'contract-templates': [activeTemplate], auctions: [auction] })
    mockRepos.create.mockResolvedValueOnce(row)

    const contract = await prepareContract(AUCTION_ID, 'auction', OWNER_ID)

    expect(mockRepos.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'contracts',
        data: expect.objectContaining({
          template: 'template-1',
          lot: AUCTION_ID,
          status: 'prepared',
          signedBy: OWNER_ID,
        }) as unknown,
      }),
    )
    expect(contract.signedBy).toBe(OWNER_ID)
    expect(contract.status).toBe('prepared')
  })
})

describe('signContract', () => {
  it('lets the owning user sign and stamps signedAt', async () => {
    const row = contractRow()
    mockFindDocs({ contracts: [row] })
    mockRepos.update.mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({
        ...row,
        ...args.data,
      }),
    )

    const contract = await signContract(CONTRACT_ID, OWNER_ID)

    expect(contract.status).toBe('signed')
    expect(contract.signedAt).toEqual(expect.any(String))
    expect(new Date(contract.signedAt ?? '').getTime()).toBeGreaterThan(0)
    expect(mockRepos.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'contracts',
        id: CONTRACT_ID,
        data: expect.objectContaining({
          status: 'signed',
          signedBy: OWNER_ID,
        }) as unknown,
      }),
    )
  })

  it('rejects signing by a different user and changes nothing', async () => {
    const row = contractRow()
    mockFindDocs({ contracts: [row] })

    await expect(signContract(CONTRACT_ID, 'attacker-1')).rejects.toThrow(
      'Contract belongs to another user',
    )
    expect(mockRepos.update).not.toHaveBeenCalled()
  })

  it('voids a prepared contract older than 15 minutes and refuses the signature', async () => {
    const stale = contractRow({
      createdAt: new Date(Date.now() - 15 * 60 * 1000 - 1000).toISOString(),
    })
    mockFindDocs({ contracts: [stale] })
    mockRepos.update.mockResolvedValueOnce({ ...stale, status: 'voided' })

    await expect(signContract(CONTRACT_ID, OWNER_ID)).rejects.toThrow(
      'Signing session expired',
    )
    expect(mockRepos.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'contracts',
        id: CONTRACT_ID,
        data: { status: 'voided' },
      }),
    )
  })

  it('does not void a contract still inside the 15-minute window', async () => {
    const fresh = contractRow({
      createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    })
    mockFindDocs({ contracts: [fresh] })
    mockRepos.update.mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({
        ...fresh,
        ...args.data,
      }),
    )

    const contract = await signContract(CONTRACT_ID, OWNER_ID)
    expect(contract.status).toBe('signed')
  })

  it('records the sha256 hash of the rendered content on the signed row', async () => {
    const row = contractRow()
    mockFindDocs({ contracts: [row] })
    mockRepos.update.mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({
        ...row,
        ...args.data,
      }),
    )

    const contract = await signContract(CONTRACT_ID, OWNER_ID)

    const expectedHash = crypto.createHash('sha256').update(RENDERED_HTML).digest('hex')
    expect(contract.contentHash).toBe(expectedHash)
    expect(contract.contentHash).toMatch(/^[0-9a-f]{64}$/)
  })
})

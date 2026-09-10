'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminRepositories } from '../_lib/admin'
import {
  assertCan,
  PermissionDeniedError,
  type AdminPermission,
  type StaffRole,
} from '../_lib/permissions'
import { docxXmlToHtml, extractDocxDocumentXml, isZipArchive } from '../admin/contracts/_components/docx'
import {
  buildValidationMessage,
  extractTemplateTokens,
  templateFixtureData,
  validateTemplateTokens,
} from '../admin/contracts/_components/placeholder-catalogue'

import { renderTemplate, type ContractTemplate } from '@/lib/contracts/render'
import type { CoreRepositories } from '@/lib/data/repositories'
import {
  contractStatuses,
  contractTemplateSourceFormats,
  contractTemplateTypes,
  type ContractTemplateSourceFormat,
  type ContractTemplateType,
} from '@/lib/data/schema'
import { adminUrl } from '@/lib/routing/admin-base-server'

const contractsPath = '/admin/contracts'
const templatesPath = '/admin/contracts/templates'

const MIN_REASON_LENGTH = 5
const RESEND_THROTTLE_MS = 60 * 60 * 1000
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function redirectWithError(path: string, message: string): Promise<never> {
  redirect(await adminUrl(`${path}?viga=${encodeURIComponent(message)}`))
}

async function redirectWithNotice(path: string, message: string): Promise<never> {
  redirect(await adminUrl(`${path}?teade=${encodeURIComponent(message)}`))
}

function audit(
  repositories: CoreRepositories,
  entry: { actorId: string; action: string; entityType: string; entityId: string; after: unknown },
): Promise<unknown> {
  return repositories.create({
    collection: 'audit-entry',
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      after: entry.after,
    },
  })
}

/** Permission denied becomes an explicit Estonian redirect error, never a silent no-op. */
async function assertPermissionOrRedirect(
  role: StaffRole,
  permission: AdminPermission,
  path: string,
): Promise<void> {
  try {
    assertCan(role, permission)
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return redirectWithError(path, error.message)
    }
    throw error
  }
}

function permissionMessage(role: StaffRole, permission: AdminPermission): string | null {
  try {
    assertCan(role, permission)
    return null
  } catch (error) {
    if (error instanceof PermissionDeniedError) return error.message
    throw error
  }
}

// Mirrors src/lib/contracts/service.ts: prepared -> sent -> signed, void is
// only legal before signing and requires the dedicated reason+outcome form.
const allowedTransitions: Record<string, readonly string[]> = {
  prepared: ['sent', 'signed'],
  sent: ['signed'],
  signed: [],
  voided: [],
}

export async function updateContractStatusAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  const status = readText(formData, 'status')
  const editPath = `${contractsPath}/${id}`

  if (!id) return redirectWithError(contractsPath, 'Lepingu identifikaator puudub.')
  await assertPermissionOrRedirect(session.role, 'contracts:write', contractsPath)
  if (!contractStatuses.includes(status as (typeof contractStatuses)[number])) {
    return redirectWithError(editPath, 'Vali sobiv lepingu olek.')
  }
  if (status === 'voided') {
    return redirectWithError(
      contractsPath,
      'Tühistamine nõuab põhjust ja tulemuse valikut — kasuta loendi "Tühista" vormi.',
    )
  }

  const contract = await repositories.findByID({ collection: 'contracts', id })
  if (!contract) return redirectWithError(contractsPath, 'Lepingut ei leitud.')

  if (!allowedTransitions[contract.status]?.includes(status)) {
    return redirectWithError(
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
    return redirectWithError(editPath, `Lepingu oleku muutmine ebaõnnestus: ${failure}`)
  }

  revalidatePath(contractsPath)
  revalidatePath(editPath)
  redirect(await adminUrl(editPath))
}

/**
 * Void with a typed reason (>= 5 chars, D7) and an outcome: contract-only,
 * or contract + auction result (superadmin only, lot returns to `ended`).
 */
export async function voidContractAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  const reason = readText(formData, 'reason')
  const outcome = readText(formData, 'outcome')

  if (!id) return redirectWithError(contractsPath, 'Tühistamiseks puudub lepingu identifikaator.')
  await assertPermissionOrRedirect(session.role, 'contracts:write', contractsPath)
  if (reason.length < MIN_REASON_LENGTH) {
    return redirectWithError(
      contractsPath,
      `Tühistamise põhjus on kohustuslik (vähemalt ${String(MIN_REASON_LENGTH)} tähemärki).`,
    )
  }
  if (outcome !== 'contract' && outcome !== 'contract-and-result') {
    return redirectWithError(contractsPath, 'Vali tühistamise tulemus: ainult leping või leping ja tulemus.')
  }
  if (outcome === 'contract-and-result' && session.role !== 'superadmin') {
    return redirectWithError(
      contractsPath,
      'Lepingu ja oksjoni tulemuse tühistamise peab tegema superadmin.',
    )
  }

  const contract = await repositories.findByID({ collection: 'contracts', id })
  if (!contract) return redirectWithError(contractsPath, 'Lepingut ei leitud.')
  if (contract.status === 'signed') {
    return redirectWithError(`${contractsPath}/${id}`, 'Allkirjastatud lepingut tühistada ei saa.')
  }
  if (contract.status === 'voided') {
    return redirectWithError(`${contractsPath}/${id}`, 'Leping on juba tühistatud.')
  }

  const auction = await repositories.findByID({ collection: 'auctions', id: contract.lotId })
  let auctionReverted = false
  if (outcome === 'contract-and-result' && auction?.status === 'contract') {
    await repositories.update({
      collection: 'auctions',
      id: contract.lotId,
      data: { status: 'ended', winningBid: null, finalPriceCents: null },
    })
    auctionReverted = true
  }

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'contracts',
      id,
      data: { status: 'voided' },
    })
    await audit(repositories, {
      actorId: session.userId,
      action: 'contract.void',
      entityType: 'contract',
      entityId: id,
      after: {
        reason,
        outcome,
        previousStatus: contract.status,
        auctionId: contract.lotId,
        auctionReverted,
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(contractsPath, `Lepingu tühistamine ebaõnnestus: ${failure}`)
  }

  revalidatePath(contractsPath)
  revalidatePath(`${contractsPath}/${id}`)
  return redirectWithNotice(
    contractsPath,
    auctionReverted
      ? 'Leping tühistatud; oksjoni tulemus tühistatud ja lot tagasi olekus "lõppenud".'
      : 'Leping tühistatud.',
  )
}

/** Re-send the signing invitation; throttled server-side to one per hour. */
export async function resendContractAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) return redirectWithError(contractsPath, 'Uuesti saatmiseks puudub lepingu identifikaator.')
  await assertPermissionOrRedirect(session.role, 'contracts:write', contractsPath)

  const contract = await repositories.findByID({ collection: 'contracts', id })
  if (!contract) return redirectWithError(contractsPath, 'Lepingut ei leitud.')
  if (contract.status !== 'sent') {
    return redirectWithError(contractsPath, 'Uuesti saab saata ainult saadetud (ootel) lepingut.')
  }

  const previous = await repositories.find({
    collection: 'audit-entry',
    where: {
      and: [
        { action: { equals: 'contract.resend' } },
        { entityId: { equals: id } },
      ],
    },
    sort: '-createdAt',
    limit: 1,
  })
  const lastResend = previous.docs[0]
  if (lastResend) {
    const elapsed = Date.now() - Date.parse(lastResend.createdAt)
    if (Number.isFinite(elapsed) && elapsed < RESEND_THROTTLE_MS) {
      const remainingMinutes = Math.max(1, Math.ceil((RESEND_THROTTLE_MS - elapsed) / 60000))
      return redirectWithError(
        contractsPath,
        `Saada uuesti saab ainult üks kord tunnis. Proovi uuesti umbes ${String(remainingMinutes)} min pärast.`,
      )
    }
  }

  const history = await repositories.find({
    collection: 'audit-entry',
    where: {
      and: [
        { action: { equals: 'contract.resend' } },
        { entityId: { equals: id } },
      ],
    },
    pagination: false,
    limit: 500,
  })

  let failure: string | null = null
  try {
    await audit(repositories, {
      actorId: session.userId,
      action: 'contract.resend',
      entityType: 'contract',
      entityId: id,
      after: { resendCount: history.docs.length + 1 },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(contractsPath, `Uuesti saatmine ebaõnnestus: ${failure}`)
  }

  revalidatePath(contractsPath)
  return redirectWithNotice(contractsPath, 'Allkirjastamise kutse saadetud uuesti.')
}

export interface ContractDocumentPayload {
  ok: boolean
  html: string
  error: string | null
}

/** Inline document viewer source (docs 08 "Vaata dokument"); views are not audit-logged. */
export async function getContractDocumentAction(id: string): Promise<ContractDocumentPayload> {
  const { session, repositories } = await requireAdminRepositories()
  const denied = permissionMessage(session.role, 'contracts:read')
  if (denied) return { ok: false, html: '', error: denied }

  const contract = await repositories.findByID({ collection: 'contracts', id })
  if (!contract) return { ok: false, html: '', error: 'Lepingut ei leitud.' }

  const html = typeof contract.renderedHtml === 'string' ? contract.renderedHtml : ''
  if (html === '') {
    return { ok: false, html: '', error: 'Lepingu dokument ei ole veel renderdatud.' }
  }
  return { ok: true, html, error: null }
}

export interface ContractContainerPayload {
  ok: boolean
  filename: string
  content: string
  mimeType: string
  error: string | null
}

/**
 * Container download (docs 08 "Laadi allkirjakonteiner"): the entry is
 * audited BEFORE the bytes are handed to the client — an audit failure
 * aborts the download.
 */
export async function getContractContainerAction(id: string): Promise<ContractContainerPayload> {
  const { session, repositories } = await requireAdminRepositories()
  const denied = permissionMessage(session.role, 'contracts:read')
  if (denied) {
    return { ok: false, filename: '', content: '', mimeType: '', error: denied }
  }

  const contract = await repositories.findByID({ collection: 'contracts', id })
  if (!contract) {
    return { ok: false, filename: '', content: '', mimeType: '', error: 'Lepingut ei leitud.' }
  }
  const content = typeof contract.renderedHtml === 'string' ? contract.renderedHtml : ''
  if (content === '') {
    return {
      ok: false,
      filename: '',
      content: '',
      mimeType: '',
      error: 'Lepingu konteiner ei ole veel saadaval.',
    }
  }

  const filename = `leping-${contract.id}.html`
  try {
    await audit(repositories, {
      actorId: session.userId,
      action: 'contract.download_container',
      entityType: 'contract',
      entityId: contract.id,
      after: { filename, bytes: content.length },
    })
  } catch (error) {
    return {
      ok: false,
      filename: '',
      content: '',
      mimeType: '',
      error: `Konteineri allalaadimine ebaõnnestus: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  return { ok: true, filename, content, mimeType: 'text/html; charset=utf-8', error: null }
}

function readTemplatePlaceholders(placeholders: unknown): { key: string }[] {
  if (!Array.isArray(placeholders)) return []
  return placeholders.flatMap((item) => {
    const key = (item as { key?: unknown } | null)?.key
    return typeof key === 'string' ? [{ key }] : []
  })
}

/** Head = newest version row of one named template; the page groups by type::name. */
function byNewestVersion(
  a: { createdAt: string; updatedAt: string },
  b: { createdAt: string; updatedAt: string },
): number {
  const byUpdated = Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  if (byUpdated !== 0) return byUpdated
  return Date.parse(b.createdAt) - Date.parse(a.createdAt)
}

async function findTemplateVersionsByName(
  repositories: CoreRepositories,
  template: { name: string; type: string },
) {
  return repositories.find({
    collection: 'contract-templates',
    where: {
      and: [
        { name: { equals: template.name } },
        { type: { equals: template.type } },
      ],
    },
    pagination: false,
    limit: 500,
  })
}

/**
 * DOCX/HTML template upload (docs 08 Mallid): tokens are validated against
 * the placeholder catalogue before the draft row is created — unknown
 * tokens reject the upload, required tokens per type are enforced. New
 * versions are drafts (active: false); activation is a separate audited step.
 */
export async function uploadContractTemplateAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const name = readText(formData, 'name')
  const type = readText(formData, 'type')

  await assertPermissionOrRedirect(session.role, 'contracts:write', templatesPath)
  if (name.length < 2) return redirectWithError(templatesPath, 'Sisesta malli nimi (vähemalt 2 tähemärki).')
  if (!contractTemplateTypes.includes(type as ContractTemplateType)) {
    return redirectWithError(templatesPath, 'Vali malli tüüp: raamleping või oksjonileping.')
  }
  const templateType = type as ContractTemplateType

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return redirectWithError(templatesPath, 'Vali üleslaaditav DOCX- või HTML-fail.')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return redirectWithError(templatesPath, 'Fail on liiga suur (lubatud kuni 10 MB).')
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  let source: string
  if (isZipArchive(bytes)) {
    try {
      source = docxXmlToHtml(extractDocxDocumentXml(bytes))
    } catch (error) {
      return redirectWithError(
        templatesPath,
        `DOCX-faili lugemine ebaõnnestus: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  } else {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    if (!text.includes('{{') && !/<[a-z!]/i.test(text)) {
      return redirectWithError(
        templatesPath,
        'Toetame DOCX- ja HTML-malle; muud failivormid ei ole lubatud.',
      )
    }
    source = text
  }

  const tokens = extractTemplateTokens(source)
  const validation = validateTemplateTokens(templateType, tokens)
  const validationMessage = buildValidationMessage(validation)
  if (validationMessage) return redirectWithError(templatesPath, validationMessage)

  const existing = await repositories.find({
    collection: 'contract-templates',
    where: { type: { equals: templateType } },
    pagination: false,
    limit: 500,
  })
  const version = `${String(existing.docs.length + 1)}.0`

  let failure: string | null = null
  let createdId: string | null = null
  try {
    const created = await repositories.create({
      collection: 'contract-templates',
      data: {
        name,
        type: templateType,
        version,
        placeholders: tokens.map((key) => ({ key })),
        active: false,
      },
    })
    createdId = created.id
    await audit(repositories, {
      actorId: session.userId,
      action: 'template.upload',
      entityType: 'contract-template',
      entityId: created.id,
      after: { name, type: templateType, version, tokens },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure || !createdId) {
    return redirectWithError(templatesPath, `Malli üleslaadimine ebaõnnestus: ${failure ?? 'tundmatu viga'}`)
  }

  revalidatePath(templatesPath)
  revalidatePath(contractsPath)
  return redirectWithNotice(templatesPath, `Mall loodud mustandina (versioon ${version}).`)
}

/**
 * Activate one version per type: the repository hook deactivates the
 * previous active in the same write; both transitions are audited.
 */
export async function activateContractTemplateAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  if (!id) return redirectWithError(templatesPath, 'Aktiveerimiseks puudub malli identifikaator.')
  await assertPermissionOrRedirect(session.role, 'contracts:write', templatesPath)

  const template = await repositories.findByID({ collection: 'contract-templates', id })
  if (!template) return redirectWithError(templatesPath, 'Malli ei leitud.')
  if (template.active) return redirectWithError(templatesPath, 'Mall on juba aktiivne.')

  const previousActive = await repositories.find({
    collection: 'contract-templates',
    where: {
      and: [
        { type: { equals: template.type } },
        { active: { equals: true } },
      ],
    },
    sort: '-updatedAt',
    limit: 1,
  })
  const previous = previousActive.docs[0]

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'contract-templates',
      id,
      data: { active: true },
    })
    if (previous) {
      await audit(repositories, {
        actorId: session.userId,
        action: 'template.deactivate',
        entityType: 'contract-template',
        entityId: previous.id,
        after: {
          reason: `Aktiivne versioon vahetatud: ${template.name} (v${template.version})`,
          supersededBy: template.id,
          type: template.type,
        },
      })
    }
    await audit(repositories, {
      actorId: session.userId,
      action: 'template.activate',
      entityType: 'contract-template',
      entityId: id,
      after: {
        type: template.type,
        version: template.version,
        previousTemplateId: previous?.id ?? null,
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(templatesPath, `Malli aktiveerimine ebaõnnestus: ${failure}`)
  }

  revalidatePath(templatesPath)
  revalidatePath(contractsPath)
  return redirectWithNotice(
    templatesPath,
    previous
      ? `Mall aktiivne (v${template.version}); eelmine versioon läks arhiivi.`
      : `Mall aktiivne (v${template.version}).`,
  )
}

/** Deactivation is reversible but audited with a mandatory typed reason. */
export async function deactivateContractTemplateAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  const reason = readText(formData, 'reason')

  if (!id) return redirectWithError(templatesPath, 'Deaktiveerimiseks puudub malli identifikaator.')
  await assertPermissionOrRedirect(session.role, 'contracts:write', templatesPath)
  if (reason.length < MIN_REASON_LENGTH) {
    return redirectWithError(
      templatesPath,
      `Deaktiveerimise põhjus on kohustuslik (vähemalt ${String(MIN_REASON_LENGTH)} tähemärki).`,
    )
  }

  const template = await repositories.findByID({ collection: 'contract-templates', id })
  if (!template) return redirectWithError(templatesPath, 'Malli ei leitud.')
  if (!template.active) return redirectWithError(templatesPath, 'Mall ei ole aktiivne.')

  let failure: string | null = null
  try {
    await repositories.update({
      collection: 'contract-templates',
      id,
      data: { active: false },
    })
    await audit(repositories, {
      actorId: session.userId,
      action: 'template.deactivate',
      entityType: 'contract-template',
      entityId: id,
      after: { reason, type: template.type, version: template.version },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure) {
    return redirectWithError(templatesPath, `Malli deaktiveerimine ebaõnnestus: ${failure}`)
  }

  revalidatePath(templatesPath)
  revalidatePath(contractsPath)
  return redirectWithNotice(templatesPath, 'Mall deaktiveeritud.')
}

export interface TemplateTestRenderPayload {
  ok: boolean
  html: string
  error: string | null
}

/**
 * Test-render drawer source: renders the template against the fictional
 * fixture set; pure preview, nothing is persisted (docs 08 "Testrender").
 * Always serves the head version's stored source so previewing an older
 * version shows what a new draft would render.
 */
export async function testRenderTemplateAction(id: string): Promise<TemplateTestRenderPayload> {
  const { session, repositories } = await requireAdminRepositories()
  const denied = permissionMessage(session.role, 'contracts:read')
  if (denied) return { ok: false, html: '', error: denied }

  const template = await repositories.findByID({ collection: 'contract-templates', id })
  if (!template) return { ok: false, html: '', error: 'Malli ei leitud.' }

  const { docs: versions } = await findTemplateVersionsByName(repositories, template)
  const head = [...versions].sort(byNewestVersion)[0]
  if (!head) return { ok: false, html: '', error: 'Malli ei leitud.' }

  const fixture = templateFixtureData()
  const placeholders = readTemplatePlaceholders(template.placeholders)
  const data: Record<string, string> = {}
  for (const { key } of placeholders) {
    data[key] = fixture[key] ?? `[${key}]`
  }
  const view: ContractTemplate = {
    name: template.name,
    type: template.type,
    version: template.version,
    placeholders,
    active: template.active,
    sourceContent: head.sourceContent,
    sourceFormat: head.sourceFormat,
  }
  const rendered = renderTemplate(view, data)
  return { ok: true, html: rendered.html, error: null }
}

/**
 * Editor draft save (docs 08 "Malli redaktor"): the textarea source becomes a
 * NEW inactive version row; name/type/placeholders copy from the head so the
 * draft joins the same version group. Activation stays a separate audited step.
 */
export async function saveTemplateDraftAction(formData: FormData): Promise<void> {
  const { session, repositories } = await requireAdminRepositories()

  const id = readText(formData, 'id')
  const sourceContent = readText(formData, 'sourceContent')
  const sourceFormat = readText(formData, 'sourceFormat')
  const version = readText(formData, 'version')

  if (!id) return redirectWithError(templatesPath, 'Salvestamiseks puudub malli identifikaator.')
  await assertPermissionOrRedirect(session.role, 'contracts:write', templatesPath)
  if (version.length === 0) {
    return redirectWithError(templatesPath, 'Sisesta versiooninumber.')
  }
  if (!contractTemplateSourceFormats.includes(sourceFormat as ContractTemplateSourceFormat)) {
    return redirectWithError(templatesPath, 'Vali lähtevorming: HTML või TXT.')
  }

  const template = await repositories.findByID({ collection: 'contract-templates', id })
  if (!template) return redirectWithError(templatesPath, 'Malli ei leitud.')

  const { docs: versions } = await findTemplateVersionsByName(repositories, template)
  const head = [...versions].sort(byNewestVersion)[0]
  if (!head) return redirectWithError(templatesPath, 'Malli ei leitud.')
  if (versions.some((row) => row.version === version)) {
    return redirectWithError(templatesPath, `Versioon "${version}" on selle malli jaoks juba kasutusel.`)
  }

  let failure: string | null = null
  let createdId: string | null = null
  try {
    const created = await repositories.create({
      collection: 'contract-templates',
      data: {
        name: head.name,
        type: head.type,
        version,
        placeholders: readTemplatePlaceholders(head.placeholders),
        sourceContent,
        sourceFormat: sourceFormat as ContractTemplateSourceFormat,
        active: false,
      },
    })
    createdId = created.id
    await audit(repositories, {
      actorId: session.userId,
      action: 'template.draft_save',
      entityType: 'contract-template',
      entityId: created.id,
      after: {
        name: head.name,
        type: head.type,
        version,
        sourceFormat,
        bytes: sourceContent.length,
        baseTemplateId: head.id,
      },
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (failure || !createdId) {
    return redirectWithError(templatesPath, `Mustandi salvestamine ebaõnnestus: ${failure ?? 'tundmatu viga'}`)
  }

  revalidatePath(templatesPath)
  revalidatePath(contractsPath)
  return redirectWithNotice(templatesPath, `Mustand salvestatud (versioon ${version}).`)
}

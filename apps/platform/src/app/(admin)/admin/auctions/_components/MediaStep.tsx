'use client'

import { useId, useState } from 'react'
import type { ChangeEvent, MouseEvent } from 'react'

import type { WizardStepContext } from './wizard-model'
import { FieldError, FieldHint, FieldLabel } from './wizard-ui'
import { inputClass, secondaryButtonClass } from '../../../_components/FormField'
import {
  MAX_EDITOR_IMAGE_BYTES,
  MAX_EDITOR_PDF_BYTES,
  attachmentTagLabels,
  attachmentTags,
  formatFileSize,
  validateEditorAttachmentUpload,
  validateEditorImageUpload,
} from '../../media/_lib/media-upload'
import type { AttachmentTag } from '../../media/_lib/media-upload'

import { apiFetch } from '@/lib/api/client'
/**
 * Media section of Sisu (docs/design/admin/03 step 5): image upload with
 * D6 validation, the per-image alt text and focal-point picker, and the
 * PDF attachment list with its Takseer/Metsateatised/Muu tag select.
 *
 * Picked files upload through POST /api/v1/media, which stores the original
 * in R2, records the media row and queues the rendition job (hero 1600x1000,
 * gallery 1200x750, thumb 350x175) — the lot references the returned URL, so
 * URL pasting is gone. The min-width rule runs here, the only side that can
 * decode the image.
 */

interface UploadedMedia {
  url: string
  filename: string
  id?: string | undefined
  mimeType?: string | undefined
}

/** POSTs the file to the wizard upload endpoint and returns its media URL. */
async function uploadToMediaLibrary(
  file: File,
  extra: Record<string, string> = {},
): Promise<UploadedMedia> {
  const body = new FormData()
  body.append('file', file)
  for (const [key, value] of Object.entries(extra)) {
    body.append(key, value)
  }
  const response = await apiFetch('/api/v1/media', { method: 'POST', body })
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'Üleslaadimine ebaõnnestus.'
    throw new Error(message)
  }
  const url =
    typeof data === 'object' && data !== null && typeof (data as { url?: unknown }).url === 'string'
      ? (data as { url: string }).url
      : null
  if (url === null || url === '') {
    throw new Error('Üleslaadimine ebaõnnestus.')
  }
  const filename =
    typeof data === 'object' && data !== null && typeof (data as { filename?: unknown }).filename === 'string'
      ? (data as { filename: string }).filename
      : file.name
  const id =
    typeof data === 'object' && data !== null && typeof (data as { id?: unknown }).id === 'string'
      ? (data as { id: string }).id
      : undefined
  const mimeType =
    typeof data === 'object' && data !== null && typeof (data as { mimeType?: unknown }).mimeType === 'string'
      ? (data as { mimeType: string }).mimeType
      : undefined
  return { url, filename, id, mimeType }
}

const mediaAltErrorKey = (index: number): [string, string] => [
  `media.${String(index)}.alt`,
  `media[${String(index)}].alt`,
]

const fileTagErrorKey = (index: number): [string, string] => [
  `files.${String(index)}.tag`,
  `files[${String(index)}].tag`,
]

interface MeasuredImage {
  width: number
  height: number
}

/** Decodes the picked image client-side; returns null when undecodable. */
async function measureImage(file: File): Promise<MeasuredImage | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const measured = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return measured
  } catch {
    return null
  }
}

function resetFileInput(event: ChangeEvent<HTMLInputElement>): void {
  event.target.value = ''
}

/** Pointer position inside the focal preview as 0..1 fractions. */
function focalFromPointer(event: MouseEvent<HTMLButtonElement>): { x: number; y: number } {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }
}

const focalInputClass = `${inputClass} w-20`

export function MediaStep({
  state,
  patch,
  errors,
  initial,
}: Omit<WizardStepContext, 'goToStep'>) {
  const id = useId()
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [attachmentUploadError, setAttachmentUploadError] = useState<string | null>(null)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [newFileTag, setNewFileTag] = useState<AttachmentTag>('muu')

  // Stored attachments are not seeded into the client state (the server
  // entry predates the files list), so an existing lot must never write
  // `files`: the payload would replace stored rows with session-only rows.
  const filesEditable = initial.auctionId === null
  const files = state.files ?? []

  function patchMedia(index: number, alt: string): void {
    patch({
      media: state.media.map((item, i) => (i === index ? { ...item, alt } : item)),
    })
  }

  function patchFocalPoint(index: number, focalX: number, focalY: number): void {
    patch({
      media: state.media.map((item, i) =>
        i === index ? { ...item, focalX, focalY } : item,
      ),
    })
  }

  function patchFocalAxis(index: number, axis: 'focalX' | 'focalY', value: number | undefined): void {
    patch({
      media: state.media.map((item, i) => {
        if (i !== index) return item
        const { [axis]: _dropped, ...rest } = item
        return value === undefined ? rest : { ...rest, [axis]: value }
      }),
    })
  }

  function clearFocal(index: number): void {
    patch({
      media: state.media.map((item, i) => {
        if (i !== index) return item
        const { focalX: _focalX, focalY: _focalY, ...rest } = item
        return rest
      }),
    })
  }

  function moveMedia(index: number, delta: -1 | 1): void {
    const target = index + delta
    if (target < 0 || target >= state.media.length) return
    const next = [...state.media]
    const [moved] = next.splice(index, 1)
    if (moved === undefined) return
    next.splice(target, 0, moved)
    patch({ media: next })
  }

  function removeMedia(index: number): void {
    patch({ media: state.media.filter((_, i) => i !== index) })
  }

  async function onImagePicked(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    resetFileInput(event)
    if (!file) return
    const measured = await measureImage(file)
    const error = validateEditorImageUpload({
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      ...(measured !== null ? { width: measured.width } : {}),
    })
    if (error !== null) {
      setImageUploadError(error)
      return
    }
    if (measured === null) {
      setImageUploadError('Pildi mõõtmeid ei õnnestunud lugeda.')
      return
    }
    setImageUploadError(null)
    setUploadingImage(true)
    try {
      const uploaded = await uploadToMediaLibrary(file, {
        width: String(measured.width),
        height: String(measured.height),
      })
      // id/filename/mimeType travel with the lot so the public page can tell
      // image entries from documents; /api/v1/media/<uuid> has no extension.
      patch({
        media: [
          ...state.media,
          {
            url: uploaded.url,
            alt: '',
            filename: uploaded.filename,
            ...(uploaded.id !== undefined ? { id: uploaded.id } : {}),
            ...(uploaded.mimeType !== undefined ? { mimeType: uploaded.mimeType } : {}),
          },
        ],
      })
    } catch (uploadError) {
      setImageUploadError(
        uploadError instanceof Error ? uploadError.message : 'Üleslaadimine ebaõnnestus.',
      )
    } finally {
      setUploadingImage(false)
    }
  }

  async function onAttachmentPicked(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    resetFileInput(event)
    if (!file) return
    const error = validateEditorAttachmentUpload({
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    })
    if (error !== null) {
      setAttachmentUploadError(error)
      return
    }
    setAttachmentUploadError(null)
    setUploadingAttachment(true)
    try {
      const uploaded = await uploadToMediaLibrary(file)
      patch({ files: [...files, { url: uploaded.url, tag: newFileTag }] })
      setNewFileTag('muu')
    } catch (uploadError) {
      setAttachmentUploadError(
        uploadError instanceof Error ? uploadError.message : 'Üleslaadimine ebaõnnestus.',
      )
    } finally {
      setUploadingAttachment(false)
    }
  }

  function patchFileTag(index: number, tag: AttachmentTag): void {
    patch({
      files: files.map((item, i) => (i === index ? { ...item, tag } : item)),
    })
  }

  function removeFile(index: number): void {
    patch({ files: files.filter((_, i) => i !== index) })
  }

  return (
    <>
      <fieldset className="flex flex-col gap-xs rounded-card border border-border p-sm">
        <legend className="px-xs text-label font-semibold text-ink">
          Pildid (hero ja galerii)
        </legend>
        <FieldHint>
          Aktsepteeritakse JPEG-, PNG- ja WebP-faile kuni {formatFileSize(MAX_EDITOR_IMAGE_BYTES)},
          laius vähemalt 1200 px. Igal pildil peab olema alternatiivtekst — ilma selleta
          avaldamine ei läbi. Loendi esimene pilt on hero-pilt. Pärast üleslaadimist tehakse
          taustal renditsioonid (hero, galerii, pisipilt).
        </FieldHint>
        <div className="flex flex-wrap items-center gap-xs">
          <label htmlFor={`${id}-image-upload`} className={`${secondaryButtonClass} cursor-pointer`}>
            {uploadingImage ? 'Laadin üles…' : 'Vali ja laadi pilt üles'}
          </label>
          <input
            id={`${id}-image-upload`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploadingImage}
            onChange={(event) => {
              void onImagePicked(event)
            }}
            className="sr-only"
          />
        </div>
        {imageUploadError !== null ? <FieldError message={imageUploadError} /> : null}
        {state.media.length === 0 ? (
          <p className="text-bodySm text-inkMuted">Pilte ei ole lisatud.</p>
        ) : (
          <ol className="flex flex-col gap-xs">
            {state.media.map((item, index) => {
              const [schemaKey, gateKey] = mediaAltErrorKey(index)
              const altError = errors[schemaKey] ?? errors[gateKey]
              return (
                <li
                  key={`${String(index)}-${item.url}`}
                  className="flex flex-col gap-1 rounded-input border border-border bg-bgPage p-sm"
                >
                  <div className="flex flex-wrap items-center gap-xs">
                    <span className="rounded-pill bg-bgMist px-2 text-bodySm font-semibold text-ink">
                      {String(index + 1)}
                    </span>
                    <code className="min-w-0 flex-1 truncate font-mono text-bodySm text-inkMuted">
                      {item.url}
                    </code>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => {
                        moveMedia(index, -1)
                      }}
                      aria-label={`Tõsta pilt ${String(index + 1)} üles`}
                      className="rounded-button border border-border px-2 py-1 text-label text-ink disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === state.media.length - 1}
                      onClick={() => {
                        moveMedia(index, 1)
                      }}
                      aria-label={`Tõsta pilt ${String(index + 1)} alla`}
                      className="rounded-button border border-border px-2 py-1 text-label text-ink disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removeMedia(index)
                      }}
                      className="whitespace-nowrap rounded-button px-2 py-1 text-label text-inkMuted transition-colors duration-hover ease-hover hover:text-danger"
                    >
                      Eemalda
                    </button>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-sm">
                    <div className="flex flex-col gap-1 sm:flex-1">
                      <FieldLabel htmlFor={`${id}-media-alt-${String(index)}`} required>
                        Alternatiivtekst
                      </FieldLabel>
                      <input
                        id={`${id}-media-alt-${String(index)}`}
                        value={item.alt}
                        onChange={(event) => {
                          patchMedia(index, event.target.value)
                        }}
                        className={`${inputClass} ${altError !== undefined ? 'border-danger' : ''}`}
                      />
                      <FieldError message={altError} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-label font-semibold text-ink">Fookuspunkt</span>
                      <button
                        type="button"
                        aria-label={`Vali pildi ${String(index + 1)} fookuspunkt klõpsiga`}
                        onClick={(event) => {
                          // Keyboard activation reports (0,0); keyboard
                          // users set the focal point via the X/Y inputs.
                          if (event.detail === 0) return
                          const focal = focalFromPointer(event)
                          patchFocalPoint(index, focal.x, focal.y)
                        }}
                        className="relative h-20 w-32 overflow-hidden rounded-input border border-border"
                      >
                        <img
                          src={item.url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        {item.focalX !== undefined && item.focalY !== undefined ? (
                          <span
                            aria-hidden
                            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-pill border border-white bg-primary"
                            style={{
                              left: `${String(item.focalX * 100)}%`,
                              top: `${String(item.focalY * 100)}%`,
                            }}
                          />
                        ) : null}
                      </button>
                      <div className="flex items-center gap-xs">
                        <label
                          htmlFor={`${id}-media-focal-x-${String(index)}`}
                          className="text-label text-inkMuted"
                        >
                          X %
                        </label>
                        <input
                          id={`${id}-media-focal-x-${String(index)}`}
                          type="number"
                          min={0}
                          max={100}
                          value={
                            item.focalX === undefined ? '' : String(Math.round(item.focalX * 100))
                          }
                          onChange={(event) => {
                            const raw = event.target.value.trim()
                            if (raw === '') {
                              patchFocalAxis(index, 'focalX', undefined)
                              return
                            }
                            const percent = Number(raw)
                            patchFocalAxis(
                              index,
                              'focalX',
                              Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) / 100 : undefined,
                            )
                          }}
                          className={focalInputClass}
                        />
                        <label
                          htmlFor={`${id}-media-focal-y-${String(index)}`}
                          className="text-label text-inkMuted"
                        >
                          Y %
                        </label>
                        <input
                          id={`${id}-media-focal-y-${String(index)}`}
                          type="number"
                          min={0}
                          max={100}
                          value={
                            item.focalY === undefined ? '' : String(Math.round(item.focalY * 100))
                          }
                          onChange={(event) => {
                            const raw = event.target.value.trim()
                            if (raw === '') {
                              patchFocalAxis(index, 'focalY', undefined)
                              return
                            }
                            const percent = Number(raw)
                            patchFocalAxis(
                              index,
                              'focalY',
                              Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) / 100 : undefined,
                            )
                          }}
                          className={focalInputClass}
                        />
                        {item.focalX !== undefined || item.focalY !== undefined ? (
                          <button
                            type="button"
                            onClick={() => {
                              clearFocal(index)
                            }}
                            className="whitespace-nowrap text-label text-inkMuted underline"
                          >
                            Eemalda
                          </button>
                        ) : null}
                      </div>
                      <FieldHint>Klõpsa pisipildil või sisesta X/Y protsentides.</FieldHint>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-xs rounded-card border border-border p-sm">
        <legend className="px-xs text-label font-semibold text-ink">Failid (PDF)</legend>
        <FieldHint>
          Manused peavad olema PDF-failid kuni {formatFileSize(MAX_EDITOR_PDF_BYTES)}. Igal
          manusel on silt: Takseer, Metsateatised või Muu.
        </FieldHint>
        {filesEditable ? (
          <>
            <div className="flex flex-wrap items-center gap-xs">
              <label
                htmlFor={`${id}-file-upload`}
                className={`${secondaryButtonClass} cursor-pointer`}
              >
                {uploadingAttachment ? 'Laadin üles…' : 'Vali ja laadi PDF üles'}
              </label>
              <input
                id={`${id}-file-upload`}
                type="file"
                accept="application/pdf"
                disabled={uploadingAttachment}
                onChange={(event) => {
                  void onAttachmentPicked(event)
                }}
                className="sr-only"
              />
              <select
                aria-label="Uue manuse silt"
                value={newFileTag}
                onChange={(event) => {
                  setNewFileTag(event.target.value as AttachmentTag)
                }}
                className={`${inputClass} max-w-40`}
              >
                {attachmentTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {attachmentTagLabels[tag]}
                  </option>
                ))}
              </select>
            </div>
            {attachmentUploadError !== null ? (
              <FieldError message={attachmentUploadError} />
            ) : null}
            {files.length === 0 ? (
              <p className="text-bodySm text-inkMuted">Manuseid ei ole lisatud.</p>
            ) : (
              <ol className="flex flex-col gap-xs">
                {files.map((item, index) => {
                  const [schemaKey, gateKey] = fileTagErrorKey(index)
                  const tagError = errors[schemaKey] ?? errors[gateKey]
                  return (
                    <li
                      key={`${String(index)}-${item.url}`}
                      className="flex flex-col gap-1 rounded-input border border-border bg-bgPage p-sm"
                    >
                      <div className="flex flex-wrap items-center gap-xs">
                        <code className="min-w-0 flex-1 truncate font-mono text-bodySm text-inkMuted">
                          {item.url}
                        </code>
                        <select
                          aria-label={`Manuse ${String(index + 1)} silt`}
                          value={item.tag}
                          onChange={(event) => {
                            patchFileTag(index, event.target.value as AttachmentTag)
                          }}
                          className={`${inputClass} max-w-40 ${tagError !== undefined ? 'border-danger' : ''}`}
                        >
                          {attachmentTags.map((tag) => (
                            <option key={tag} value={tag}>
                              {attachmentTagLabels[tag]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            removeFile(index)
                          }}
                          className="whitespace-nowrap rounded-button px-2 py-1 text-label text-inkMuted transition-colors duration-hover ease-hover hover:text-danger"
                        >
                          Eemalda
                        </button>
                      </div>
                      <FieldError message={tagError} />
                    </li>
                  )
                })}
              </ol>
            )}
          </>
        ) : (
          <FieldHint>
            Olemasoleva loti manuseid siin veel ei muudeta: salvestatud read tuleb kaitsta
            asendamise eest, kuni serveri sisestus need eelnevalt sisse loeb.
          </FieldHint>
        )}
      </fieldset>
    </>
  )
}

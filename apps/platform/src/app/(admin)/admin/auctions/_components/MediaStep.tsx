'use client'

import { useId, useState } from 'react'
import type { ChangeEvent, MouseEvent } from 'react'

import type { WizardStepContext } from './wizard-model'
import { FieldError, FieldHint, FieldLabel } from './wizard-ui'
import { inputClass, secondaryButtonClass } from '../../../_components/FormField'
import {
  MAX_EDITOR_IMAGE_BYTES,
  MAX_EDITOR_PDF_BYTES,
  RENDITION_SPECS,
  attachmentTagLabels,
  attachmentTags,
  formatFileSize,
  validateEditorAttachmentUpload,
  validateEditorImageUpload,
} from '../../media/_lib/media-upload'
import type { AttachmentTag } from '../../media/_lib/media-upload'
/**
 * Media section of Sisu (docs/design/admin/03 step 5): image upload with
 * D6 validation, the per-image alt text and focal-point picker, and the
 * PDF attachment list with its Takseer/Metsateatised/Muu tag select.
 *
 * Renditions (hero 1600x1000, gallery 1200x750, thumb 350x175) are declared
 * in media-upload.ts, but no worker-runtime mechanism can generate them yet
 * and the wizard form has no non-redirecting upload endpoint, so a picked
 * file is validated here and the operator is pointed at the media library
 * until a media upload endpoint lands (reported gap, task 2.6).
 */

const mediaAltErrorKey = (index: number): [string, string] => [
  `media.${String(index)}.alt`,
  `media[${String(index)}].alt`,
]

const fileTagErrorKey = (index: number): [string, string] => [
  `files.${String(index)}.tag`,
  `files[${String(index)}].tag`,
]

interface MeasuredImage {
  filename: string
  width: number
  height: number
}

/** Decodes the picked image client-side; returns null when undecodable. */
async function measureImage(file: File): Promise<MeasuredImage | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const measured = { filename: file.name, width: bitmap.width, height: bitmap.height }
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
  const [newImageUrl, setNewImageUrl] = useState('')
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)
  const [validatedImage, setValidatedImage] = useState<MeasuredImage | null>(null)
  const [attachmentUploadError, setAttachmentUploadError] = useState<string | null>(null)
  const [validatedAttachment, setValidatedAttachment] = useState<string | null>(null)
  const [newFileUrl, setNewFileUrl] = useState('')
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

  function addMediaByUrl(): void {
    const url = newImageUrl.trim()
    if (url === '') return
    patch({ media: [...state.media, { url, alt: '' }] })
    setNewImageUrl('')
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
      setValidatedImage(null)
      return
    }
    if (measured === null) {
      setImageUploadError('Pildi mõõtmeid ei õnnestunud lugeda.')
      setValidatedImage(null)
      return
    }
    setImageUploadError(null)
    setValidatedImage(measured)
  }

  function onAttachmentPicked(event: ChangeEvent<HTMLInputElement>): void {
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
      setValidatedAttachment(null)
      return
    }
    setAttachmentUploadError(null)
    setValidatedAttachment(`${file.name} (${formatFileSize(file.size)})`)
  }

  function patchFileTag(index: number, tag: AttachmentTag): void {
    patch({
      files: files.map((item, i) => (i === index ? { ...item, tag } : item)),
    })
  }

  function removeFile(index: number): void {
    patch({ files: files.filter((_, i) => i !== index) })
  }

  function addFileByUrl(): void {
    const url = newFileUrl.trim()
    if (url === '') return
    patch({ files: [...files, { url, tag: newFileTag }] })
    setNewFileUrl('')
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
          avaldamine ei läbi. Loendi esimene pilt on hero-pilt.
        </FieldHint>
        <div className="flex flex-wrap items-center gap-xs">
          <label htmlFor={`${id}-image-upload`} className={`${secondaryButtonClass} cursor-pointer`}>
            Vali pilt
          </label>
          <input
            id={`${id}-image-upload`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              void onImagePicked(event)
            }}
            className="sr-only"
          />
        </div>
        {imageUploadError !== null ? <FieldError message={imageUploadError} /> : null}
        {validatedImage !== null ? (
          <p className="text-bodySm text-inkMuted">
            {validatedImage.filename} — {String(validatedImage.width)}×
            {String(validatedImage.height)} px. Fail läbis valideerimise. Võlurist üleslaadimine
            pole veel avatud: laadi pilt üles meediakogus ja kleebi selle URL allpool.
            Sihtrenditsioonid:{' '}
            {RENDITION_SPECS.map(
              (spec) => `${spec.name} ${String(spec.width)}×${String(spec.height)}`,
            ).join(', ')}
            .
          </p>
        ) : null}
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
        <div className="flex items-center gap-xs">
          <input
            value={newImageUrl}
            placeholder="https://… pildi URL"
            onChange={(event) => {
              setNewImageUrl(event.target.value)
            }}
            className={`${inputClass} max-w-md`}
            aria-label="Uue pildi URL"
          />
          <button
            type="button"
            onClick={addMediaByUrl}
            className={secondaryButtonClass}
            disabled={newImageUrl.trim() === ''}
          >
            Lisa pilt
          </button>
        </div>
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
                Vali PDF
              </label>
              <input
                id={`${id}-file-upload`}
                type="file"
                accept="application/pdf"
                onChange={onAttachmentPicked}
                className="sr-only"
              />
            </div>
            {attachmentUploadError !== null ? (
              <FieldError message={attachmentUploadError} />
            ) : null}
            {validatedAttachment !== null ? (
              <p className="text-bodySm text-inkMuted">
                {validatedAttachment} läbis valideerimise. Võlurist üleslaadimine pole veel
                avatud: laadi manus üles meediakogus ja kleebi selle URL allpool.
              </p>
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
            <div className="flex flex-wrap items-center gap-xs">
              <input
                value={newFileUrl}
                placeholder="https://… faili URL"
                onChange={(event) => {
                  setNewFileUrl(event.target.value)
                }}
                className={`${inputClass} max-w-md`}
                aria-label="Uue manuse URL"
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
              <button
                type="button"
                onClick={addFileByUrl}
                className={secondaryButtonClass}
                disabled={newFileUrl.trim() === ''}
              >
                Lisa fail
              </button>
            </div>
          </>
        ) : (
          <FieldHint>
            Manusete haldamine avaneb pärast üleslaadimise teenuse lisamist. Olemasolevad failid
            jäävad muutmata.
          </FieldHint>
        )}
      </fieldset>
    </>
  )
}

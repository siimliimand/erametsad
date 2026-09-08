'use client'

import { useId, useRef, useState, useTransition } from 'react'

import { HtmlPreviewDrawer } from './HtmlPreviewDrawer'
import { PLACEHOLDER_GROUPS } from './placeholder-catalogue'
import { saveTemplateDraftAction, testRenderTemplateAction } from '../../../_actions/contracts'
import { PencilIcon } from '../../../_components/icons'
import { Modal } from '../../../_components/ui/Modal'
import { useToast, type PushToast } from '../../../_components/ui/Toast'

export interface TemplateTokenInsertion {
  value: string
  caretStart: number
  caretEnd: number
}

/**
 * Pure chip-insertion used by the editor textarea: the token replaces the
 * current selection (collapsed to the cursor) and the caret lands after it.
 */
export function insertTemplateTokenAtCursor(
  value: string,
  selectionStart: number | null,
  selectionEnd: number | null,
  token: string,
): TemplateTokenInsertion {
  const start = selectionStart ?? value.length
  const end = Math.max(start, selectionEnd ?? start)
  const caret = start + token.length
  return {
    value: `${value.slice(0, start)}${token}${value.slice(end)}`,
    caretStart: caret,
    caretEnd: caret,
  }
}

interface TemplateEditorModalProps {
  templateId: string
  name: string
  version: string
  /** Head version's stored editor source; absent or NULL keeps an empty editor. */
  initialSourceContent?: string | null
  initialSourceFormat?: 'html' | 'txt' | null
  /** Suggested next version for the draft save ("3.0" -> "3.1"). */
  nextVersion?: string
}

const editorButtonClass =
  'inline-flex h-8 items-center gap-1.5 rounded-button border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary'

const chipClass =
  'rounded-pill border border-border bg-bg-mist px-2 py-0.5 font-mono text-label text-ink-muted transition-colors duration-hover ease-hover hover:border-primary hover:text-primary'

const areaClass =
  'min-h-[320px] w-full rounded-input border border-border bg-bgPage p-md font-mono text-bodySm text-ink focus:border-primary focus:outline-none'

const primaryButtonClass =
  'inline-flex h-8 items-center gap-1.5 rounded-button bg-primary px-3 text-label font-semibold text-inkInverse transition-[filter] duration-hover ease-hover hover:brightness-90'

const ghostButtonClass =
  'inline-flex h-8 items-center rounded-button border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary'

const versionInputClass =
  'h-8 w-24 rounded-input border border-border bg-bgPage px-2 text-bodySm text-ink focus:border-primary focus:outline-none'

// Card and modal unit tests mount without ToastProvider (AdminShell provides
// it app-wide), so a missing provider degrades to a no-op instead of throwing.
function useOptionalToast(): PushToast | null {
  try {
    return useToast()
  } catch {
    return null
  }
}

// Mirrors SettingsSaveForm.redirectTargetUrl: a redirecting server action
// rejects with a NEXT_REDIRECT digest (`NEXT_REDIRECT;replace;<url>;<status>`).
function redirectTargetUrl(error: unknown): string | null {
  const digest = (error as { digest?: unknown } | null)?.digest
  if (typeof digest !== 'string' || !digest.startsWith('NEXT_REDIRECT')) {
    return null
  }
  return digest.split(';')[2] ?? ''
}

function redirectErrorDescription(target: string | null): string | undefined {
  if (target === null) return undefined
  const raw = target.split('viga=')[1]
  return raw === undefined ? undefined : decodeURIComponent(raw)
}

/**
 * Demo 08 "Malli redaktor": HTML/TXT source drafting with clickable
 * placeholder chips from the shared catalogue that insert at the textarea
 * cursor, and a test-render button that reuses HtmlPreviewDrawer. "Salvesta"
 * persists the draft as a NEW inactive version via saveTemplateDraftAction;
 * activation stays the explicit card action.
 */
export function TemplateEditorModal({
  templateId,
  name,
  version,
  initialSourceContent = null,
  initialSourceFormat = null,
  nextVersion,
}: TemplateEditorModalProps) {
  const pushToast = useOptionalToast()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState('')
  const [draftVersion, setDraftVersion] = useState(nextVersion ?? '')
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const areaId = useId()
  const versionId = useId()

  // DOCX-only templates carry no editor source, so the editor opens empty and
  // the draft defaults to HTML — the format the editor itself produces.
  const headSource = initialSourceContent ?? ''
  const sourceFormat = initialSourceFormat ?? 'html'

  function openEditor(): void {
    setSource(headSource)
    setDraftVersion(nextVersion ?? '')
    setOpen(true)
  }

  function closeEditor(): void {
    setOpen(false)
  }

  function insertToken(token: string): void {
    const area = areaRef.current
    if (!area) return
    const insertion = insertTemplateTokenAtCursor(
      area.value,
      area.selectionStart,
      area.selectionEnd,
      token,
    )
    setSource(insertion.value)
    window.requestAnimationFrame(() => {
      area.focus()
      area.setSelectionRange(insertion.caretStart, insertion.caretEnd)
    })
  }

  /**
   * The action always redirects (?teade= success / ?viga= failure), so the
   * digest target decides the outcome; a failure keeps the draft on screen.
   */
  function saveDraft(): void {
    const submittedVersion = draftVersion.trim()
    startTransition(async () => {
      const formData = new FormData()
      formData.set('id', templateId)
      formData.set('sourceContent', source)
      formData.set('sourceFormat', sourceFormat)
      formData.set('version', submittedVersion)
      try {
        await saveTemplateDraftAction(formData)
      } catch (error) {
        const target = redirectTargetUrl(error)
        if (target === null || target.includes('viga=')) {
          const description = redirectErrorDescription(target)
          pushToast?.({
            tone: 'error',
            title: 'Mustandi salvestamine ebaõnnestus.',
            ...(description === undefined ? {} : { description }),
          })
          return
        }
      }
      pushToast?.({
        tone: 'success',
        title: `Mustand salvestatud (versioon ${submittedVersion}).`,
      })
      closeEditor()
    })
  }

  return (
    <>
      <button type="button" onClick={openEditor} className={editorButtonClass}>
        <PencilIcon className="h-3.5 w-3.5" />
        Muuda redaktoris
      </button>
      <Modal
        open={open}
        onClose={closeEditor}
        title={`Mall: ${name} (v${version})`}
        size="lg"
        footer={
          <>
            <div className="mr-auto flex items-center gap-2">
              <label htmlFor={versionId} className="text-label font-semibold text-ink">
                Uus versioon
              </label>
              <input
                id={versionId}
                value={draftVersion}
                onChange={(event) => {
                  setDraftVersion(event.target.value)
                }}
                spellCheck={false}
                className={versionInputClass}
              />
            </div>
            <button type="button" onClick={closeEditor} className={ghostButtonClass}>
              Sulge
            </button>
            <HtmlPreviewDrawer
              label="Testrender näidisandmetega"
              drawerTitle={`Testrender — ${name} (v${version})`}
              documentId={templateId}
              fetchDocument={testRenderTemplateAction}
              triggerClassName={primaryButtonClass}
            />
            <button
              type="button"
              onClick={saveDraft}
              disabled={pending || draftVersion.trim() === ''}
              className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Salvesta
            </button>
          </>
        }
      >
        <p className="text-bodySm text-ink-muted">
          Klõpsa kohatäidet, et lisada see kursori kohale lähteteksti. Redaktor sobib HTML- ja
          TXT-mallidele; „Salvesta“ salvestab lähteteksti uue passiivse versioonina, aktiveerimine
          on eraldi tegevus.
        </p>

        <div className="flex flex-col gap-xs" role="group" aria-label="Kohatäited">
          {PLACEHOLDER_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <span className="text-label font-semibold text-ink-muted">{group.label}</span>
              <div className="flex flex-wrap gap-1.5">
                {group.tokens.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => {
                      insertToken(`{{${token}}}`)
                    }}
                    aria-label={`Sisesta kohatäide {{${token}}}`}
                    className={chipClass}
                  >
                    {`{{${token}}}`}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={areaId} className="text-label font-semibold text-ink">
            Malli lähtetekst (HTML või TXT)
          </label>
          <textarea
            ref={areaRef}
            id={areaId}
            value={source}
            onChange={(event) => {
              setSource(event.target.value)
            }}
            spellCheck={false}
            rows={14}
            placeholder="Kirjuta või kleebi malli lähtetekst siia"
            className={areaClass}
          />
        </div>
      </Modal>
    </>
  )
}

'use client'

import { useId, useRef, useState } from 'react'

import { HtmlPreviewDrawer } from './HtmlPreviewDrawer'
import { PLACEHOLDER_GROUPS } from './placeholder-catalogue'
import { testRenderTemplateAction } from '../../../_actions/contracts'
import { PencilIcon } from '../../../_components/icons'
import { Modal } from '../../../_components/ui/Modal'

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

/**
 * Demo 08 "Malli redaktor": HTML/TXT source drafting with clickable
 * placeholder chips from the shared catalogue that insert at the textarea
 * cursor, and a test-render button that reuses HtmlPreviewDrawer (it shows
 * the saved version with fixture data — the draft itself is not persisted).
 */
export function TemplateEditorModal({ templateId, name, version }: TemplateEditorModalProps) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState('')
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const areaId = useId()

  function openEditor(): void {
    setSource('')
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
          </>
        }
      >
        <p className="text-bodySm text-ink-muted">
          Klõpsa kohatäidet, et lisada see kursori kohale lähteteksti. Redaktor sobib HTML- ja
          TXT-mallidele; valmis lähtetekst laaditakse üles failina „Uus mall“ vormis.
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

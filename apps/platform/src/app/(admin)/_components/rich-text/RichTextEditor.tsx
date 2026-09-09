'use client'

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { ClipboardEvent, KeyboardEvent, MouseEvent, Ref } from 'react'

import {
  applyBlockTag,
  applyLink,
  captureSelection,
  getEditorHtml,
  insertImage,
  insertSanitizedHtml,
  insertTable,
  restoreSelection,
  setEditorContent,
  toggleBold,
  toggleList,
} from './rich-text-commands'
import type { RichTextImage } from './rich-text-commands'
import { escapePlainText } from './rich-text-sanitize'

export type { RichTextImage } from './rich-text-commands'

export interface RichTextEditorHandle {
  /** Inserts a media-library image at the caret; appends at the end when unfocused. */
  insertImage: (image: RichTextImage) => void
}

export interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  /**
   * Media integration hook. When given, the toolbar shows "Lisa pilt"; the
   * host opens its media picker, resolves a picked asset ({ url, alt }: the
   * MediaAsset fields), and the editor inserts it at the caret.
   */
  onRequestImage?: () => Promise<RichTextImage | null> | RichTextImage | null
  disabled?: boolean
  ariaLabel?: string
}

const toolbarButtonClass =
  'inline-flex h-8 items-center rounded-button border border-border bg-bgPage px-2 text-label text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'

function plainTextToParagraphs(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${escapePlainText(line)}</p>`)
    .join('')
}

/**
 * Toolbar-limited rich text editor shared by the auction wizard copy blocks
 * and the CMS screens (article body, FAQ answers, legal documents, text
 * blocks). Controlled component: `value`/`onChange` carry sanitized HTML.
 * Output is always passed through the allowlist sanitizer, so hosts can
 * persist it and render it without a second sanitizing pass.
 */
export function RichTextEditor({
  value,
  onChange,
  onRequestImage,
  disabled = false,
  ariaLabel = 'Rikastatud tekstiredaktor',
  ref,
}: RichTextEditorProps & { ref?: Ref<RichTextEditorHandle> }) {
  const editableRef = useRef<HTMLDivElement | null>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const emit = useCallback(() => {
    const root = editableRef.current
    if (root) onChange(getEditorHtml(root))
  }, [onChange])

  // External value changes hydrate the editable only when the user is not
  // typing in it; rewriting innerHTML under a live caret would reset it.
  useEffect(() => {
    const root = editableRef.current
    if (!root) return
    if (getEditorHtml(root) === value) return
    if (root.ownerDocument.activeElement === root) return
    setEditorContent(root.ownerDocument, root, value)
  }, [value])

  useImperativeHandle(
    ref,
    () => ({
      insertImage: (image: RichTextImage) => {
        const root = editableRef.current
        if (!root) return
        const doc = root.ownerDocument
        if (!captureSelection(doc, root)) {
          const range = doc.createRange()
          range.selectNodeContents(root)
          range.collapse(false)
          restoreSelection(doc, root, range)
        }
        insertImage(doc, root, image)
        emit()
      },
    }),
    [emit],
  )

  // Actions return false only when nothing changed and re-emitting is pointless.
  const withEditable = useCallback(
    (action: (doc: Document, root: HTMLElement) => unknown) => {
      const root = editableRef.current
      if (!root || disabled) return
      if (action(root.ownerDocument, root) !== false) emit()
    },
    [disabled, emit],
  )

  const keepSelection = (event: MouseEvent<HTMLButtonElement>) => {
    // Buttons must not steal the text selection they are about to modify.
    event.preventDefault()
  }

  const openLinkRow = (event: MouseEvent<HTMLButtonElement>) => {
    keepSelection(event)
    const root = editableRef.current
    if (!root || disabled) return
    savedRangeRef.current = captureSelection(root.ownerDocument, root)
    setLinkUrl('')
    setLinkOpen(true)
  }

  const submitLink = () => {
    withEditable((doc, root) => {
      const saved = savedRangeRef.current
      if (saved) restoreSelection(doc, root, saved)
      const ok = applyLink(doc, root, linkUrl)
      if (ok) {
        savedRangeRef.current = null
        setLinkOpen(false)
      }
      return ok
    })
  }

  const pickAndInsertImage = async () => {
    const root = editableRef.current
    if (!root || disabled || !onRequestImage) return
    const doc = root.ownerDocument
    savedRangeRef.current = captureSelection(doc, root)
    const picked = await onRequestImage()
    if (!picked) return
    const saved = savedRangeRef.current
    if (saved) restoreSelection(doc, root, saved)
    else {
      const range = doc.createRange()
      range.selectNodeContents(root)
      range.collapse(false)
      restoreSelection(doc, root, range)
    }
    insertImage(doc, root, picked)
    emit()
  }

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    withEditable((doc, root) => {
      const clipboard = event.clipboardData
      const html = clipboard.getData('text/html')
      if (html !== '') {
        insertSanitizedHtml(doc, root, html)
        return true
      }
      const text = clipboard.getData('text/plain')
      if (text !== '') {
        insertSanitizedHtml(doc, root, plainTextToParagraphs(text))
        return true
      }
      return false
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
      event.preventDefault()
      withEditable((doc, root) => {
        toggleBold(doc, root)
      })
    }
  }

  return (
    <div className="rounded-card border border-border bg-bgPage focus-within:border-primary">
      <div
        role="toolbar"
        aria-label="Vormindus"
        className="flex flex-wrap items-center gap-xs border-b border-border p-xs"
      >
        <button
          type="button"
          className={toolbarButtonClass}
          disabled={disabled}
          title="Pealkiri 2"
          onMouseDown={keepSelection}
          onClick={() => {
            withEditable((doc, root) => {
              applyBlockTag(doc, root, 'h2')
            })
          }}
        >
          Pealkiri 2
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          disabled={disabled}
          title="Pealkiri 3"
          onMouseDown={keepSelection}
          onClick={() => {
            withEditable((doc, root) => {
              applyBlockTag(doc, root, 'h3')
            })
          }}
        >
          Pealkiri 3
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          disabled={disabled}
          title="Tavaline tekst"
          onMouseDown={keepSelection}
          onClick={() => {
            withEditable((doc, root) => {
              applyBlockTag(doc, root, 'p')
            })
          }}
        >
          Tavaline
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          disabled={disabled}
          title="Rasvane (Ctrl+B)"
          onMouseDown={keepSelection}
          onClick={() => {
            withEditable((doc, root) => {
              toggleBold(doc, root)
            })
          }}
        >
          <span className="font-bold">B</span>
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          disabled={disabled}
          title="Järjestamata loend"
          onMouseDown={keepSelection}
          onClick={() => {
            withEditable((doc, root) => {
              toggleList(doc, root, 'ul')
            })
          }}
        >
          • Loend
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          disabled={disabled}
          title="Järjestatud loend"
          onMouseDown={keepSelection}
          onClick={() => {
            withEditable((doc, root) => {
              toggleList(doc, root, 'ol')
            })
          }}
        >
          1. Loend
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          disabled={disabled}
          title="Link"
          aria-expanded={linkOpen}
          onMouseDown={openLinkRow}
        >
          Link
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          disabled={disabled}
          title="Sisesta tabel"
          onMouseDown={keepSelection}
          onClick={() => {
            withEditable((doc, root) => {
              insertTable(doc, root)
            })
          }}
        >
          Tabel
        </button>
        {onRequestImage ? (
          <button
            type="button"
            className={toolbarButtonClass}
            disabled={disabled}
            title="Lisa pilt meediakogust"
            onMouseDown={keepSelection}
            onClick={() => {
            void pickAndInsertImage()
          }}
          >
            Lisa pilt
          </button>
        ) : null}
      </div>
      {linkOpen ? (
        <div className="flex items-center gap-xs border-b border-border p-xs">
          <input
            type="url"
            className="h-8 flex-1 rounded-input border border-border bg-bgPage px-2 text-bodySm text-ink outline-none focus:border-primary"
            placeholder="https://"
            aria-label="Lingi URL"
            value={linkUrl}
            onChange={(event) => {
              setLinkUrl(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submitLink()
              }
            }}
          />
          <button
            type="button"
            className={toolbarButtonClass}
            onMouseDown={keepSelection}
            onClick={submitLink}
          >
            Lisa link
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            onMouseDown={(event) => {
              event.preventDefault()
              setLinkOpen(false)
              setLinkUrl('')
            }}
          >
            Tühista
          </button>
        </div>
      ) : null}
      <div
        ref={editableRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        aria-disabled={disabled}
        className="min-h-32 p-sm text-ink outline-none [&_a]:text-primary [&_a]:underline [&_img]:max-w-full [&_ol]:list-decimal [&_ol]:pl-4 [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-xs [&_th]:border [&_th]:border-border [&_th]:p-xs [&_ul]:list-disc [&_ul]:pl-4"
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
      />
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'

import {
  insertVariableAtCursor,
  smsSegmentInfo,
  templateChannelLabels,
  templateEvents,
  templateVariables,
} from './notification-template-utils'
import {
  deleteNotificationTemplateAction,
  listNotificationTemplatesAction,
  restoreNotificationTemplateAction,
  saveNotificationTemplateAction,
  sendNotificationTestAction,
  type NotificationTemplateRow,
} from '../../../_actions/notifications'

import type { TemplateChannel } from '@/lib/data/schema'

interface EditorState {
  id?: string
  event: string
  channel: TemplateChannel
  subject: string
  body: string
  reason: string
}

interface Notice {
  tone: 'ok' | 'error'
  text: string
}

const newEditor: EditorState = {
  event: 'auction.published',
  channel: 'email',
  subject: '',
  body: '',
  reason: '',
}

function groupKey(row: Pick<NotificationTemplateRow, 'event' | 'channel'>): string {
  return `${row.event}:${row.channel}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('et-EE', { dateStyle: 'short', timeStyle: 'short' })
}

const inputClass =
  'h-10 w-full rounded-input border border-border bg-bgPage px-3 text-bodySm text-ink outline-none transition-colors duration-hover ease-hover focus:border-primary focus:ring-2 focus:ring-primary/20'

const secondaryButtonClass =
  'inline-flex h-9 items-center rounded-input border border-border bg-bgPage px-3.5 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Teavitused section (task 4.3): template list, editor with a variable
 * inserter, test send, version history with restore, and an SMS
 * character/segment counter. Rows load through the audited server actions,
 * so every listed mutation lands in the audit log with its reason.
 */
export function NotificationTemplates() {
  const [rows, setRows] = useState<NotificationTemplateRow[] | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NotificationTemplateRow | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [restoreReason, setRestoreReason] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let cancelled = false
    void listNotificationTemplatesAction().then((loaded) => {
      if (!cancelled) setRows(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const groups = new Map<string, { active: NotificationTemplateRow; versions: NotificationTemplateRow[] }>()
  for (const row of rows ?? []) {
    const key = groupKey(row)
    const group = groups.get(key) ?? { active: row, versions: [] }
    if (row.active) {
      group.active = row
    }
    group.versions.push(row)
    groups.set(key, group)
  }

  async function reload(): Promise<void> {
    setRows(await listNotificationTemplatesAction())
  }

  function run(action: () => Promise<Notice>): void {
    if (busy) return
    setBusy(true)
    void action()
      .then(setNotice)
      .finally(() => {
        setBusy(false)
      })
  }

  function insertVariable(name: string): void {
    if (!editor) return
    const element = bodyRef.current
    const cursor = element?.selectionStart ?? editor.body.length
    const next = insertVariableAtCursor(editor.body, cursor, name)
    setEditor({ ...editor, body: next.text })
    requestAnimationFrame(() => {
      if (element) {
        element.selectionStart = next.cursor
        element.selectionEnd = next.cursor
        element.focus()
      }
    })
  }

  const sms = editor?.channel === 'sms' ? smsSegmentInfo(editor.body) : null

  return (
    <section
      id="sec-teavitused"
      aria-labelledby="sec-teavitused-heading"
      className="scroll-mt-[calc(var(--topbar-h)+var(--space-md))] overflow-hidden rounded-card border border-border bg-bgPage shadow-card"
    >
      <div className="border-b border-border px-md py-xs">
        <h2
          id="sec-teavitused-heading"
          className="font-heading text-[16px] font-semibold leading-[22px] text-ink"
        >
          Teavitused
        </h2>
      </div>
      <div className="space-y-sm px-md py-sm">
        <p className="text-bodySm text-inkMuted">
          Sündmuste teavituste mallid e-posti ja SMS-i jaoks. Iga muudatus salvestatakse uue
          versioonina ja logitakse auditilogisse koos põhjendusega.
        </p>

        {notice ? (
          <p
            role="status"
            className={`rounded-card px-sm py-xs text-label font-medium ${
              notice.tone === 'ok' ? 'bg-infoLight text-info' : 'bg-dangerLight text-danger'
            }`}
          >
            {notice.text}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-left text-bodySm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-sm py-xs text-label font-semibold text-inkMuted">Sündmus</th>
                <th className="px-sm py-xs text-label font-semibold text-inkMuted">Kanal</th>
                <th className="px-sm py-xs text-label font-semibold text-inkMuted">Versioon</th>
                <th className="px-sm py-xs text-label font-semibold text-inkMuted">Uuendatud</th>
                <th className="px-sm py-xs text-label font-semibold text-inkMuted">
                  <span className="sr-only">Toimingud</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr>
                  <td colSpan={5} className="px-sm py-sm text-inkMuted">
                    Laadimine …
                  </td>
                </tr>
              ) : groups.size === 0 ? (
                <tr>
                  <td colSpan={5} className="px-sm py-sm text-inkMuted">
                    Malle pole veel. Lisa esimene mall.
                  </td>
                </tr>
              ) : (
                [...groups.entries()].map(([key, group]) => (
                  <tr key={key} className="border-b border-border last:border-b-0">
                    <td className="px-sm py-xs text-ink">
                      {templateEvents.find((e) => e.event === group.active.event)?.label ??
                        group.active.event}
                    </td>
                    <td className="px-sm py-xs text-ink">
                      {templateChannelLabels[group.active.channel]}
                    </td>
                    <td className="px-sm py-xs text-ink">
                      {group.active.version}
                      <span className="ml-1 text-label text-inkMuted">
                        ({group.versions.length} versiooni)
                      </span>
                    </td>
                    <td className="px-sm py-xs text-inkMuted">
                      {formatTime(group.active.updatedAt)}
                    </td>
                    <td className="px-sm py-xs">
                      <div className="flex flex-wrap items-center gap-xs">
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          onClick={() => {
                            setNotice(null)
                            setEditor({
                              id: group.active.id,
                              event: group.active.event,
                              channel: group.active.channel,
                              subject: group.active.subject ?? '',
                              body: group.active.body,
                              reason: '',
                            })
                          }}
                        >
                          Muuda
                        </button>
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          aria-expanded={expanded === key}
                          onClick={() => {
                            setRestoreReason('')
                            setExpanded(expanded === key ? null : key)
                          }}
                        >
                          Ajalugu
                        </button>
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          onClick={() => {
                            setDeleteTarget(group.active)
                            setDeleteReason('')
                          }}
                        >
                          Kustuta
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {expanded
          ? (() => {
              const group = groups.get(expanded)
              if (!group) return null
              return (
                <div className="rounded-card border border-border px-sm py-sm">
                  <h3 className="text-label font-semibold text-ink">Versioonide ajalugu</h3>
                  <ul className="mt-xs flex flex-col gap-xs">
                    {[...group.versions]
                      .sort((a, b) => b.version - a.version)
                      .map((version) => (
                        <li
                          key={version.id}
                          className="flex flex-wrap items-center gap-xs rounded-input bg-bgMist px-sm py-xs"
                        >
                          <span className="text-label font-semibold text-ink">
                            v{version.version}
                          </span>
                          {version.active ? (
                            <span className="rounded-full bg-infoLight px-2 py-0.5 text-label font-semibold text-info">
                              aktiivne
                            </span>
                          ) : null}
                          <span className="text-label text-inkMuted">
                            {formatTime(version.updatedAt)} ·{' '}
                            {version.updatedBy ? `${version.updatedBy.slice(0, 8)}…` : 'teadmata'}
                          </span>
                          {!version.active ? (
                            <>
                              <input
                                type="text"
                                value={restoreReason}
                                onChange={(event) => {
                                  setRestoreReason(event.target.value)
                                }}
                                placeholder="Taastamise põhjendus"
                                aria-label="Taastamise põhjendus"
                                className="h-8 w-56 rounded-input border border-border bg-bgPage px-2 text-label text-ink outline-none focus:border-primary"
                              />
                              <button
                                type="button"
                                className={secondaryButtonClass}
                                disabled={busy}
                                onClick={() => {
                                  run(async () => {
                                    const result = await restoreNotificationTemplateAction(
                                      version.id,
                                      restoreReason,
                                    )
                                    if (!result.ok) {
                                      return { tone: 'error', text: result.error ?? 'Taastamine ebaõnnestus.' }
                                    }
                                    await reload()
                                    return { tone: 'ok', text: `Versioon ${String(version.version)} taastati uue aktiivse versioonina.` }
                                  })
                                }}
                              >
                                Taasta
                              </button>
                            </>
                          ) : null}
                        </li>
                      ))}
                  </ul>
                </div>
              )
            })()
          : null}

        {deleteTarget ? (
          <div className="rounded-card border border-danger bg-dangerLight px-sm py-sm">
            <p className="text-label font-semibold text-danger">
              Kustutada mall „{templateEventLabelOf(deleteTarget)}“ (
              {templateChannelLabels[deleteTarget.channel]}) koos kõigi versioonidega?
            </p>
            <div className="mt-xs flex flex-wrap items-center gap-xs">
              <input
                type="text"
                value={deleteReason}
                onChange={(event) => {
                  setDeleteReason(event.target.value)
                }}
                placeholder="Kustutamise põhjendus"
                aria-label="Kustutamise põhjendus"
                className="h-8 w-64 rounded-input border border-border bg-bgPage px-2 text-label text-ink outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={busy}
                className="inline-flex h-8 items-center rounded-input bg-danger px-3 text-label font-semibold text-inkInverse disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  run(async () => {
                    const result = await deleteNotificationTemplateAction(
                      deleteTarget.id,
                      deleteReason,
                    )
                    if (!result.ok) {
                      return { tone: 'error', text: result.error ?? 'Kustutamine ebaõnnestus.' }
                    }
                    setDeleteTarget(null)
                    await reload()
                    return { tone: 'ok', text: 'Mall kustutati.' }
                  })
                }}
              >
                Kinnita kustutus
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => {
                  setDeleteTarget(null)
                }}
              >
                Tühista
              </button>
            </div>
          </div>
        ) : null}

        {editor ? (
          <form
            className="space-y-sm rounded-card border border-border px-sm py-sm"
            onSubmit={(event) => {
              event.preventDefault()
              const formData = new FormData()
              if (editor.id) formData.set('id', editor.id)
              formData.set('event', editor.event)
              formData.set('channel', editor.channel)
              formData.set('subject', editor.subject)
              formData.set('body', editor.body)
              formData.set('reason', editor.reason)
              run(async () => {
                const result = await saveNotificationTemplateAction(formData)
                if (!result.ok) {
                  return { tone: 'error', text: result.error ?? 'Salvestamine ebaõnnestus.' }
                }
                setEditor(null)
                await reload()
                return { tone: 'ok', text: 'Mall salvestati uue versioonina.' }
              })
            }}
          >
            <h3 className="text-label font-semibold text-ink">
              {editor.id ? 'Muuda malli' : 'Uus mall'}
            </h3>
            <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-label font-semibold text-ink">Sündmus</span>
                <select
                  value={editor.event}
                  disabled={Boolean(editor.id)}
                  onChange={(event) => {
                    setEditor({ ...editor, event: event.target.value })
                  }}
                  className={inputClass}
                >
                  {templateEvents.map((definition) => (
                    <option key={definition.event} value={definition.event}>
                      {definition.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-label font-semibold text-ink">Kanal</span>
                <select
                  value={editor.channel}
                  disabled={Boolean(editor.id)}
                  onChange={(event) => {
                    setEditor({ ...editor, channel: event.target.value as TemplateChannel })
                  }}
                  className={inputClass}
                >
                  {(Object.keys(templateChannelLabels) as TemplateChannel[]).map((channel) => (
                    <option key={channel} value={channel}>
                      {templateChannelLabels[channel]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {editor.channel === 'email' ? (
              <label className="flex flex-col gap-1">
                <span className="text-label font-semibold text-ink">Pealkiri</span>
                <input
                  type="text"
                  value={editor.subject}
                  onChange={(event) => {
                    setEditor({ ...editor, subject: event.target.value })
                  }}
                  className={inputClass}
                />
              </label>
            ) : null}
            <div className="flex flex-col gap-1">
              <span className="text-label font-semibold text-ink">Sisu</span>
              <textarea
                ref={bodyRef}
                rows={6}
                value={editor.body}
                onChange={(event) => {
                  setEditor({ ...editor, body: event.target.value })
                }}
                className="w-full rounded-input border border-border bg-bgPage px-3 py-2 text-bodySm text-ink outline-none transition-colors duration-hover ease-hover focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex flex-wrap items-center gap-xs">
                <span className="text-label text-inkMuted">Lisa muutuja:</span>
                {templateVariables.map((variable) => (
                  <button
                    key={variable.name}
                    type="button"
                    title={variable.label}
                    className="rounded-full border border-border px-2 py-0.5 text-label font-medium text-inkMuted transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
                    onClick={() => {
                      insertVariable(variable.name)
                    }}
                  >
                    {`{{${variable.name}}}`}
                  </button>
                ))}
              </div>
              {sms ? (
                <p
                  className={`text-label ${
                    sms.segments > 1 ? 'font-semibold text-danger' : 'text-inkMuted'
                  }`}
                >
                  {sms.chars} tähemärki · {sms.segments} SMS-i osa{' '}
                  {sms.segments > 1 ? '(piir ületatud — sms jaguneb mitmeks osaks)' : '(piir 160 tähemärki)'}
                </p>
              ) : null}
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-ink">Põhjendus (kohustuslik)</span>
              <textarea
                rows={2}
                value={editor.reason}
                onChange={(event) => {
                  setEditor({ ...editor, reason: event.target.value })
                }}
                className="w-full rounded-input border border-border bg-bgPage px-3 py-2 text-bodySm text-ink outline-none transition-colors duration-hover ease-hover focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <div className="flex flex-wrap items-center gap-xs">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-9 items-center rounded-button bg-primary px-3.5 text-label font-semibold text-inkInverse transition-[filter] duration-hover ease-hover hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Salvesta
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => {
                  setEditor(null)
                }}
              >
                Tühista
              </button>
            </div>
          </form>
        ) : null}

        <div className="flex flex-wrap items-center gap-xs">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => {
              setNotice(null)
              setExpanded(null)
              setEditor({ ...newEditor })
            }}
          >
            + Lisa mall
          </button>
        </div>

        <TestSendPanel
          groups={[...groups.values()]}
          busy={busy}
          onNotify={(text, tone) => {
            setNotice({ tone, text })
          }}
          onBusyChange={setBusy}
        />
      </div>
    </section>
  )
}

function templateEventLabelOf(row: NotificationTemplateRow): string {
  return templateEvents.find((definition) => definition.event === row.event)?.label ?? row.event
}

function TestSendPanel({
  groups,
  busy,
  onNotify,
  onBusyChange,
}: {
  groups: { active: NotificationTemplateRow }[]
  busy: boolean
  onNotify: (text: string, tone: 'ok' | 'error') => void
  onBusyChange: (busy: boolean) => void
}) {
  const emailGroups = groups.filter((group) => group.active.channel === 'email')
  if (emailGroups.length === 0) return null

  return (
    <div className="rounded-card border border-border px-sm py-sm">
      <h3 className="text-label font-semibold text-ink">Testsaatmine</h3>
      <p className="text-bodySm text-inkMuted">
        Saadab valitud e-posti malli testsisuga operaatori enda aadressile. SMS-i malle ei saadeta
        — need logitakse arenduskeskkonnas konsooli.
      </p>
      <div className="mt-xs flex flex-wrap items-center gap-xs">
        <select
          id="test-send-template"
          className="h-9 w-72 rounded-input border border-border bg-bgPage px-2 text-label text-ink outline-none focus:border-primary"
        >
          {emailGroups.map((group) => (
            <option key={group.active.id} value={group.active.id}>
              {templateEventLabelOf(group.active)} ({templateChannelLabels.email}, v
              {group.active.version})
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy}
          className={secondaryButtonClass}
          onClick={() => {
            const select = document.getElementById('test-send-template') as HTMLSelectElement | null
            const id = select?.value
            if (!id) return
            onBusyChange(true)
            void sendNotificationTestAction(id)
              .then((result) => {
                if (result.ok) {
                  onNotify(
                    result.recipient
                      ? `Testsaatmine õnnestus — kontrolli postkasti ${result.recipient}.`
                      : 'Testsaatmine õnnestus.',
                    'ok',
                  )
                } else {
                  onNotify(result.error ?? 'Testsaatmine ebaõnnestus.', 'error')
                }
              })
              .finally(() => {
                onBusyChange(false)
              })
          }}
        >
          Saada test
        </button>
      </div>
    </div>
  )
}

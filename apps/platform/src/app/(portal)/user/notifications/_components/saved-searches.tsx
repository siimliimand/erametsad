'use client'

import { Btn, FormSelect, Modal } from '@erametsad/ui'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  apiJson,
  apiJsonBody,
  filterChips,
  formatEstonianDateTime,
  SUBSCRIPTION_CHANNELS,
  SUBSCRIPTION_FREQUENCIES,
  subscriptionChannelLabel,
  subscriptionFrequencyLabel,
  type AuctionSubscriptionItem,
  type AuctionSubscriptionListResponse,
  type SubscriptionChannel,
  type SubscriptionFrequency,
  type UnsubscribeResponse,
} from './notifications-data'
import { SubscriptionEditModal } from './subscription-edit-modal'

type UnsubscribeState =
  | { phase: 'idle' }
  | { phase: 'pending' }
  | { phase: 'success'; message: string }
  | { phase: 'error'; message: string }

type EditTarget = { mode: 'create' } | { mode: 'edit'; subscription: AuctionSubscriptionItem }

function StaticChip({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-pill border border-border bg-bgMist px-3 py-1 font-body text-bodySm text-ink">
      {label}
    </span>
  )
}

interface SavedSearchesProps {
  unsubscribeToken: string | null
  onTokenHandled: () => void
}

export function SavedSearches({ unsubscribeToken, onTokenHandled }: SavedSearchesProps) {
  const [items, setItems] = useState<AuctionSubscriptionItem[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [deleteAllCount, setDeleteAllCount] = useState('')
  const [deleteAllBusy, setDeleteAllBusy] = useState(false)
  const [unsubscribe, setUnsubscribe] = useState<UnsubscribeState>({ phase: 'idle' })
  const handledTokenRef = useRef<string | null>(null)

  const loadItems = useCallback(async () => {
    setLoadError(null)
    try {
      const data = await apiJson<AuctionSubscriptionListResponse>('/api/v1/auction-subscriptions')
      setItems(data.items)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Tellimuste laadimine ebaõnnestus')
    }
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  // Footer-link flow: ?unsubscribe=<token> hits the token endpoint, which
  // needs no session; the URL param is stripped once handled.
  useEffect(() => {
    if (unsubscribeToken === null) return
    if (handledTokenRef.current === unsubscribeToken) return
    handledTokenRef.current = unsubscribeToken
    let cancelled = false
    setUnsubscribe({ phase: 'pending' })
    const search = new URLSearchParams({ token: unsubscribeToken })
    apiJson<UnsubscribeResponse>(
      `/api/v1/auction-subscriptions/unsubscribe?${search.toString()}`,
      { method: 'POST' },
    )
      .then((data) => {
        if (cancelled) return
        setUnsubscribe({
          phase: 'success',
          message: data.message ?? 'Tellimus on tühistatud',
        })
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setUnsubscribe({
          phase: 'error',
          message: cause instanceof Error ? cause.message : 'Tühistamine ebaõnnestus',
        })
      })
      .finally(() => {
        if (cancelled) return
        onTokenHandled()
        void loadItems()
      })
    return () => {
      cancelled = true
    }
  }, [unsubscribeToken, onTokenHandled, loadItems])

  const patchSubscription = async (
    id: string,
    data: { channel?: SubscriptionChannel; frequency?: SubscriptionFrequency },
  ) => {
    setBusyId(id)
    setActionError(null)
    try {
      const updated = await apiJsonBody<AuctionSubscriptionItem>(
        `/api/v1/auction-subscriptions/${encodeURIComponent(id)}`,
        'PATCH',
        data,
      )
      setItems((prev) => (prev ?? []).map((item) => (item.id === id ? updated : item)))
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Uuendamine ebaõnnestus')
    } finally {
      setBusyId(null)
    }
  }

  const deleteSubscription = async (id: string) => {
    setBusyId(id)
    setActionError(null)
    try {
      await apiJson<{ success: boolean }>(
        `/api/v1/auction-subscriptions/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      )
      setItems((prev) => (prev ?? []).filter((item) => item.id !== id))
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Kustutamine ebaõnnestus')
    } finally {
      setBusyId(null)
      setConfirmingId(null)
    }
  }

  const deleteAll = async () => {
    const ids = (items ?? []).map((item) => item.id)
    setDeleteAllBusy(true)
    setActionError(null)
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          apiJson<{ success: boolean }>(
            `/api/v1/auction-subscriptions/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
          ).then(() => id),
        ),
      )
      if (results.some((result) => result.status === 'rejected')) {
        throw new Error('Osa tellimuste kustutamine ebaõnnestus')
      }
      setItems([])
      setDeleteAllOpen(false)
      setDeleteAllCount('')
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Kustutamine ebaõnnestus')
      void loadItems()
    } finally {
      setDeleteAllBusy(false)
    }
  }

  const list = items ?? []
  const count = list.length

  return (
    <section
      id="otsingute-tellimused"
      aria-labelledby="saved-searches-title"
      className="scroll-mt-24 rounded-card border border-border bg-white p-6 shadow-card max-md:p-[14px]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="saved-searches-title" className="font-heading text-[22px] font-bold text-ink">
          Otsingute tellimused
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setEditTarget({ mode: 'create' }); }}
            className="inline-flex h-8 items-center justify-center rounded-button bg-primary px-3.5 text-label font-semibold text-inkInverse transition-colors duration-hover ease-hover hover:bg-primaryHover motion-reduce:transition-none"
          >
            Uus tellimus
          </button>
          {count > 0 && (
            <button
              type="button"
              onClick={() => {
                setDeleteAllCount('')
                setDeleteAllOpen(true)
              }}
              className="inline-flex h-8 items-center justify-center rounded-button border border-primary bg-transparent px-3.5 text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight motion-reduce:transition-none"
            >
              Kustuta kõik
            </button>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-[15px] text-inkMuted">
        Tellitud otsingud teavitavad sind, kui uus oksjon vastab sinu filtritele.
      </p>

      <div className="mt-3 rounded-card bg-bgMist px-[18px] py-[14px]">
        <p className="m-0 text-bodySm text-inkMuted">
          Iga otsingutellimuse e-kirja jalas on tühistamislink. Link avab selle lehe ja tühistab
          tellimuse ilma sisselogimiseta.
        </p>
      </div>

      {unsubscribe.phase === 'pending' && (
        <p role="status" className="mt-3 font-body text-body text-inkMuted">
          Tühistamine…
        </p>
      )}
      {unsubscribe.phase === 'success' && (
        <div
          role="status"
          className="mt-3 rounded-card border border-primary bg-primaryLight px-6 py-3 font-body text-body text-primaryDark"
        >
          {unsubscribe.message}
        </div>
      )}
      {unsubscribe.phase === 'error' && (
        <div
          role="alert"
          className="mt-3 rounded-card border border-danger bg-bgMist px-6 py-3 font-body text-body text-danger"
        >
          {unsubscribe.message}
        </div>
      )}

      <p className="mt-3 font-body text-body text-inkMuted">
        {items === null
          ? 'Tellimuste laadimine…'
          : count === 0
            ? 'Teil ei ole veel otsingutellimusi'
            : `Otsingutellimusi: ${String(count)}`}
      </p>

      {(loadError !== null || actionError !== null) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger bg-bgMist px-6 py-3">
          <p role="alert" className="font-body text-body text-danger">
            {loadError ?? actionError}
          </p>
          {loadError !== null && (
            <button
              type="button"
              onClick={() => void loadItems()}
              className="inline-flex h-8 items-center rounded-button border border-primary px-3.5 text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight"
            >
              Proovi uuesti
            </button>
          )}
        </div>
      )}

      {items !== null && count === 0 && (
        <div className="mt-3 rounded-card bg-bgMist px-6 py-10 text-center">
          <p className="m-0 font-body text-body text-inkMuted">
            Tellimuse loomisel saadame teavitusi, kui uued oksjonid vastavad teie valitud
            filtritele.
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-4">
        {list.map((subscription) => {
          const chips = filterChips(subscription.filter)
          const busy = busyId === subscription.id
          return (
            <article
              key={subscription.id}
              className="flex flex-col gap-3 rounded-card border border-border bg-bgPage p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-heading text-h4 font-bold text-ink">Otsingutellimus</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => { setEditTarget({ mode: 'edit', subscription }); }}
                    disabled={busy}
                    className="inline-flex h-8 items-center justify-center rounded-button border border-primary bg-transparent px-3.5 text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Muuda
                  </button>
                  {confirmingId === subscription.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void deleteSubscription(subscription.id)}
                        disabled={busy}
                        className="inline-flex h-8 items-center justify-center rounded-button bg-primary px-3.5 text-label font-semibold text-inkInverse transition-colors duration-hover ease-hover hover:bg-primaryHover motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busy ? 'Kustutan…' : 'Kinnita kustutamine'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setConfirmingId(null); }}
                        disabled={busy}
                        className="inline-flex h-8 items-center justify-center rounded-button bg-transparent px-3.5 text-label font-semibold text-inkMuted transition-colors duration-hover ease-hover hover:text-ink motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Loobu
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setConfirmingId(subscription.id); }}
                      disabled={busy}
                      className="inline-flex h-8 items-center justify-center rounded-button bg-transparent px-3.5 text-label font-semibold text-inkMuted transition-colors duration-hover ease-hover hover:text-ink motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Kustuta
                    </button>
                  )}
                </div>
              </div>

                <div className="flex flex-wrap gap-2">
                  {chips.length === 0 ? (
                    <StaticChip label="Kõik oksjonid" />
                  ) : (
                    chips.map((chip) => <StaticChip key={chip} label={chip} />)
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormSelect
                    label="Kanal"
                    name={`channel-${subscription.id}`}
                    value={subscription.channel}
                    disabled={busy}
                    onChange={(event) =>
                      void patchSubscription(subscription.id, {
                        channel: event.target.value as SubscriptionChannel,
                      })
                    }
                    options={SUBSCRIPTION_CHANNELS.map((value) => ({
                      value,
                      label: subscriptionChannelLabel(value),
                    }))}
                  />
                  <FormSelect
                    label="Sagedus"
                    name={`frequency-${subscription.id}`}
                    value={subscription.frequency}
                    disabled={busy}
                    onChange={(event) =>
                      void patchSubscription(subscription.id, {
                        frequency: event.target.value as SubscriptionFrequency,
                      })
                    }
                    options={SUBSCRIPTION_FREQUENCIES.map((value) => ({
                      value,
                      label: subscriptionFrequencyLabel(value),
                    }))}
                  />
                </div>

                <p className="font-body text-bodySm text-inkMuted">
                  Loodud {formatEstonianDateTime(subscription.createdAt)}
                </p>
            </article>
          )
        })}
      </div>

      {editTarget !== null && (
        <SubscriptionEditModal
          mode={editTarget.mode}
          initialFilter={editTarget.mode === 'edit' ? editTarget.subscription.filter : null}
          onClose={() => { setEditTarget(null); }}
          onSaved={(saved) => {
            setItems((prev) => {
              const current = prev ?? []
              return current.some((item) => item.id === saved.id)
                ? current.map((item) => (item.id === saved.id ? saved : item))
                : [saved, ...current]
            })
            setEditTarget(null)
          }}
        />
      )}

      <Modal
        isOpen={deleteAllOpen}
        onClose={() => {
          setDeleteAllOpen(false)
        }}
        title="Kustuta kõik tellimused"
        size="sm"
      >
        <div className="flex flex-col gap-md">
          <p className="font-body text-body text-ink">
            Kustutamise kinnitamiseks sisestage tellimuste arv:{' '}
            <strong className="font-semibold">{String(count)}</strong>
          </p>
          <input
            type="number"
            name="delete-all-count"
            value={deleteAllCount}
            onChange={(event) => { setDeleteAllCount(event.target.value); }}
            aria-label="Tellimuste arv"
            className="h-12 w-full rounded-button border border-border bg-bgPage px-4 font-body text-body outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex flex-wrap gap-sm">
            <Btn
              onClick={() => void deleteAll()}
              isLoading={deleteAllBusy}
              disabled={deleteAllCount.trim() !== String(count)}
            >
              Kustuta kõik
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => {
                setDeleteAllOpen(false)
              }}
              disabled={deleteAllBusy}
            >
              Loobu
            </Btn>
          </div>
        </div>
      </Modal>
    </section>
  )
}

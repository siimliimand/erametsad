'use client'

import { Modal } from '@erametsad/ui'
import { useState } from 'react'

export interface TutorialStepLink {
  href: string
  label: string
  external?: boolean
}

export interface TutorialStep {
  title: string
  text: string
  image: string | null
  imageAlt: string
  caption: string
  link?: TutorialStepLink
}

const PLACEHOLDER_NOTE = 'Kuvatõmmis tuleb pärast testimist'

function PlaceholderBox({ tone }: { tone: 'mist' | 'page' }) {
  return (
    <span
      className={`flex aspect-[16/10] w-full flex-col items-center justify-center gap-2xs rounded-card border border-dashed border-border px-md text-center ${
        tone === 'page' ? 'bg-bgPage' : 'bg-bgMist'
      }`}
    >
      <span className="font-label font-semibold uppercase tracking-wide text-inkMuted">
        {PLACEHOLDER_NOTE}
      </span>
    </span>
  )
}

export function ScreenshotSteps({ steps }: { steps: readonly TutorialStep[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const active = openIndex === null ? undefined : steps[openIndex]

  return (
    <>
      <ol className="space-y-md">
        {steps.map((step, index) => {
          const onMist = index % 2 === 1
          return (
            <li
              key={step.title}
              className={`rounded-card p-md md:p-lg ${onMist ? 'bg-bgMist' : ''}`}
            >
              <div className="flex items-start gap-sm">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-label font-bold text-ink-inverse"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-heading text-h4 text-ink">{step.title}</h3>
                  <p className="mt-2xs max-w-container-sm text-body text-inkMuted">
                    {step.text}
                  </p>
                  {step.link ? (
                    <a
                      href={step.link.href}
                      {...(step.link.external
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                      className="mt-xs inline-flex font-semibold text-primary underline hover:text-primary-hover"
                    >
                      {step.link.label}
                    </a>
                  ) : null}
                </div>
              </div>

              <figure className="mt-md">
                {step.image ? (
                  <a
                    href={step.image}
                    onClick={(event) => {
                      event.preventDefault()
                      setOpenIndex(index)
                    }}
                    aria-label={`Suurenda sammu ${String(index + 1)} kuvatõmmist`}
                    className="group block cursor-zoom-in"
                  >
                    <img
                      src={step.image}
                      alt={step.imageAlt}
                      loading="lazy"
                      className="aspect-[16/10] w-full rounded-card border border-border object-cover shadow-card transition-shadow duration-hover ease-hover group-hover:shadow-card-hover motion-reduce:transition-none"
                    />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenIndex(index)
                    }}
                    aria-label={`Suurenda sammu ${String(index + 1)} kuvatõmmist`}
                    className="block w-full cursor-zoom-in rounded-card"
                  >
                    <PlaceholderBox tone={onMist ? 'page' : 'mist'} />
                  </button>
                )}
                <figcaption className="mt-2xs text-bodySm text-inkMuted">
                  {step.caption}
                </figcaption>
              </figure>
            </li>
          )
        })}
      </ol>

      <Modal
        isOpen={active !== undefined}
        onClose={() => {
          setOpenIndex(null)
        }}
        title={active ? `${String((openIndex ?? 0) + 1)}. samm — ${active.title}` : ''}
        size="lg"
      >
        {active ? (
          <figure>
            {active.image ? (
              <img
                src={active.image}
                alt={active.imageAlt}
                className="w-full rounded-card border border-border object-contain"
              />
            ) : (
              <PlaceholderBox tone="mist" />
            )}
            <figcaption className="mt-xs text-bodySm text-inkMuted">
              {active.caption}
            </figcaption>
          </figure>
        ) : null}
      </Modal>
    </>
  )
}

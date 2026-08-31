'use client'

import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

export interface ProcessStep {
  title: string
  description: string[]
}

export interface ProcessStepGroup {
  /** Anchor id rendered on the group's section, e.g. 'oksjon' for #oksjon. */
  id: string
  title: string
  steps: ProcessStep[]
}

export interface ProcessAccordionProps {
  groups: ProcessStepGroup[]
}

function stepKey(groupId: string, index: number): string {
  return `${groupId}-${String(index + 1)}`
}

// Grouped process accordion: steps stay open independently (design doc
// 02 §Interactions), steps are numbered continuously across groups, and a
// #group anchor deep link expands that group and scrolls to its heading.
// SSR renders every step closed; the hash effect only runs client-side.
export function ProcessAccordion({ groups }: ProcessAccordionProps) {
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const raw = window.location.hash.replace('#', '')
    if (raw === '') return
    let anchor = raw
    try {
      anchor = decodeURIComponent(raw)
    } catch {
      // Keep the raw fragment when it is not valid percent-encoding.
    }
    const group = groups.find((candidate) => candidate.id === anchor)
    if (!group) return
    setOpenKeys(
      new Set(group.steps.map((_, index) => stepKey(group.id, index))),
    )
    const timer = window.setTimeout(() => {
      document
        .getElementById(group.id)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
    return () => {
      window.clearTimeout(timer)
    }
  }, [groups])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof HTMLButtonElement)) return
    if (target.dataset.stepButton === undefined) return
    const buttons = Array.from(
      containerRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[data-step-button]',
      ) ?? [],
    )
    const current = buttons.indexOf(target)
    if (current === -1) return
    let nextIndex: number
    if (event.key === 'ArrowDown') nextIndex = (current + 1) % buttons.length
    else if (event.key === 'ArrowUp')
      nextIndex = (current - 1 + buttons.length) % buttons.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = buttons.length - 1
    else return
    event.preventDefault()
    buttons[nextIndex]?.focus()
  }

  const toggleStep = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  let stepOffset = 0

  return (
    <div ref={containerRef} onKeyDown={handleKeyDown} className="space-y-xl">
      {groups.map((group) => {
        const groupOffset = stepOffset
        stepOffset += group.steps.length
        return (
          <section
            key={group.id}
            id={group.id}
            className="scroll-mt-28 lg:scroll-mt-20"
          >
            <h2 className="font-heading text-h2 text-ink">{group.title}</h2>
            <div className="mt-md divide-y divide-border overflow-hidden rounded-card border border-border bg-bgPage shadow-card">
              {group.steps.map((step, stepIndex) => {
                const key = stepKey(group.id, stepIndex)
                const isOpen = openKeys.has(key)
                const buttonId = `process-button-${key}`
                const panelId = `process-panel-${key}`
                return (
                  <div key={key}>
                    <h3>
                      <button
                        id={buttonId}
                        type="button"
                        data-step-button=""
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => {
                          toggleStep(key)
                        }}
                        className="flex w-full items-center gap-sm px-md py-sm text-left font-label font-semibold text-ink transition-colors duration-hover ease-hover hover:bg-bgMist focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
                      >
                        <span
                          aria-hidden="true"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary text-bodySm font-bold text-primary"
                        >
                          {groupOffset + stepIndex + 1}
                        </span>
                        <span className="flex-1">{step.title}</span>
                        <ChevronDown
                          aria-hidden="true"
                          className={`h-4 w-4 shrink-0 text-inkMuted transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </h3>
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      className={`overflow-hidden transition-[max-height] duration-200 ${
                        isOpen ? 'max-h-[999px]' : 'max-h-0'
                      }`}
                    >
                      <div className="space-y-xs px-md pb-md text-body text-inkMuted">
                        {step.description.map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

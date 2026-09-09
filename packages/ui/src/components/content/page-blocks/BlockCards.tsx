import { Axe, Clock, Coins, FileText, Map, Shield, Sprout, Trees } from 'lucide-react'
import type { ComponentType } from 'react'

import { Card } from '../../Card'

import type { CardItemConfig, CardsBlockConfig } from './types'

const COLUMN_CLASSES: Record<2 | 3 | 4, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

/** Lucide map for the card ikoon select; unknown names render no icon. */
const ITEM_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  trees: Trees,
  axe: Axe,
  sprout: Sprout,
  map: Map,
  shield: Shield,
  clock: Clock,
  coins: Coins,
  'file-text': FileText,
}

function CardIcon({ name }: { name: string | undefined }) {
  if (name === undefined) return null
  const Icon = ITEM_ICONS[name]
  if (Icon === undefined) return null
  return <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
}

// Description lines become bullet points, as in the process cards on avaleht.
function descriptionLines(description: string): string[] {
  return description
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

function CardBody({ item }: { item: CardItemConfig }) {
  const lines = item.description !== undefined ? descriptionLines(item.description) : []
  return (
    <>
      <CardIcon name={item.icon} />
      <h3 className={`font-heading text-h4 text-ink ${item.icon !== undefined ? 'mt-sm' : ''}`}>
        {item.href !== undefined ? (
          <a
            href={item.href}
            className="underline-offset-4 transition-colors duration-hover ease-hover hover:text-primary hover:underline"
          >
            {item.title}
          </a>
        ) : (
          item.title
        )}
      </h3>
      {lines.length > 1 ? (
        <ul className="mt-sm list-disc space-y-2 pl-5 text-bodySm text-inkMuted marker:text-primary">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        lines.length === 1 && (
          <p className="mt-xs text-bodySm text-inkMuted">{lines[0]}</p>
        )
      )}
    </>
  )
}

export function BlockCards({ config }: { config: CardsBlockConfig }) {
  return (
    <section className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
      {config.heading !== undefined && (
        <h2 className="font-heading text-h2 text-ink">{config.heading}</h2>
      )}
      {config.intro !== undefined && (
        <p
          className={`max-w-container-sm text-body text-inkMuted ${
            config.heading !== undefined ? 'mt-xs' : ''
          }`}
        >
          {config.intro}
        </p>
      )}
      <ul
        className={`grid gap-lg ${COLUMN_CLASSES[config.columns ?? 3]} ${
          config.heading !== undefined || config.intro !== undefined ? 'mt-md' : ''
        }`}
      >
        {config.items.map((item, index) => (
          <li key={[item.title, index].join('-')}>
            <Card hover={item.href !== undefined} content={<CardBody item={item} />} />
          </li>
        ))}
      </ul>
    </section>
  )
}

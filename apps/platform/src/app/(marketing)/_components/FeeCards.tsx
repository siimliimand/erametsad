import { Card } from '@erametsad/ui'
import type { ComponentType } from 'react'

export type FeeCardIcon = ComponentType<{ className?: string }>

export interface FeeCardItem {
  icon?: FeeCardIcon
  title: string
  highlight?: string
  body: string[]
}

export interface FeeCardsProps {
  cards: FeeCardItem[]
  className?: string
}

export function FeeCards({ cards, className = '' }: FeeCardsProps) {
  return (
    <div className={`grid gap-gutter md:grid-cols-2 ${className}`}>
      {cards.map(({ icon: Icon, title, highlight, body }) => (
        <Card key={title} hover={false} className="h-full">
          <div className="flex h-full flex-col p-6">
            {Icon && (
              <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
            )}
            <h3 className="mt-2xs font-heading text-h4 text-ink">{title}</h3>
            {highlight && (
              <p className="mt-xs font-heading text-h3 text-primary">
                {highlight}
              </p>
            )}
            <div className="mt-xs space-y-2xs">
              {body.map((paragraph, index) => (
                <p key={index} className="text-body text-inkMuted">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

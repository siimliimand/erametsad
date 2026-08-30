import type { SVGProps } from 'react'

// Inline Lucide-geometry icons (ISC). apps/platform does not declare
// lucide-react as a direct dependency and this task may not change
// package.json, so the few icons the login cards need are vendored here.
// Keep this file in sync with lucide-react when the dependency lands.

function Svg({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function SmartphoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-6 w-6 shrink-0" {...props}>
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </Svg>
  )
}

export function MessageSquareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-6 w-6 shrink-0" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  )
}

export function CreditCardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg className="h-6 w-6 shrink-0" {...props}>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </Svg>
  )
}

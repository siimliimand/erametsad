import type { ContractStatus } from '@/lib/data/schema'

const CONTRACT_PILL: Record<ContractStatus, { label: string; className: string }> = {
  prepared: { label: 'Koostatud', className: 'bg-statusDraft/10 text-statusDraft' },
  sent: { label: 'Saadetud', className: 'bg-info/10 text-info' },
  signed: { label: 'Allkirjastatud', className: 'bg-statusActive/10 text-statusActive' },
  voided: { label: 'Tühistatud', className: 'bg-danger/10 text-danger' },
}

export function ContractPill({ status }: { status: ContractStatus }) {
  const pill = CONTRACT_PILL[status]
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-pill px-2 py-0.5 text-xs font-medium ${pill.className}`}
    >
      {pill.label}
    </span>
  )
}

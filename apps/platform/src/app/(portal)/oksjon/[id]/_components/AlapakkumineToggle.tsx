'use client'

// The under-start request switch. The parent gates rendering with its
// allowUnderStart flag (Settings.alapakkumineEnabled); this component only
// carries the toggle state, the server decides the pending_approval outcome.

export interface AlapakkumineToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function AlapakkumineToggle({
  checked,
  onChange,
  disabled = false,
}: AlapakkumineToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        onChange(!checked)
      }}
      className="flex items-start gap-xs text-left disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-pill border px-0.5 transition-colors duration-hover ease-hover motion-reduce:transition-none ${
          checked ? 'border-primary bg-primary' : 'border-border bg-bgMist'
        }`}
      >
        <span
          className={`h-4 w-4 rounded-pill bg-bgPage transition-transform duration-hover ease-hover motion-reduce:transition-none ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
      <span className="flex flex-col">
        <span className="text-bodySm font-semibold text-ink">
          Alapakkumine alghinnast madalamalt
        </span>
        <span className="text-bodySm text-inkMuted">Nõuab müüja nõusolekut</span>
      </span>
    </button>
  )
}

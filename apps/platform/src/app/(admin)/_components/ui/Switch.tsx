'use client'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  name?: string
  disabled?: boolean
}

// Checkbox-based toggle (13-settings demo .switch): the input stays the
// accessible control (role=switch), the track is decorative and styled via
// peer variants; focus ring moves to the track like the demo.
export function Switch({ checked, onChange, label, name, disabled }: SwitchProps) {
  return (
    <span className="relative inline-block h-[22px] w-10 shrink-0 align-middle">
      <input
        type="checkbox"
        role="switch"
        name={name}
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => {
          onChange(event.target.checked)
        }}
        className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-pill bg-border transition-colors duration-hover ease-hover after:absolute after:left-[3px] after:top-[3px] after:h-4 after:w-4 after:rounded-pill after:bg-bgPage after:shadow-[0_1px_2px_rgba(24,26,46,0.25)] after:transition-transform after:duration-hover after:ease-hover peer-checked:bg-accent peer-checked:after:translate-x-[18px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:cursor-not-allowed peer-disabled:opacity-45"
      />
    </span>
  )
}

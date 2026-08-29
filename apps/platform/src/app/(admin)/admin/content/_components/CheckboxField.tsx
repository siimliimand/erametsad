export function CheckboxField({
  label,
  name,
  hint,
  defaultChecked = false,
}: {
  label: string
  name: string
  hint?: string
  defaultChecked?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={`field-${name}`}
        className="flex items-center gap-xs text-label font-semibold text-ink"
      >
        <input
          id={`field-${name}`}
          name={name}
          type="checkbox"
          value="true"
          defaultChecked={defaultChecked}
          className="h-4 w-4 accent-primary"
        />
        {label}
      </label>
      {hint ? <p className="text-bodySm text-ink-muted">{hint}</p> : null}
    </div>
  )
}

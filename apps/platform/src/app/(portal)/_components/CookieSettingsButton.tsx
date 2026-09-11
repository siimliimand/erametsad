'use client'

// CookieBanner (task 1.4) reopens when this event fires on document. The
// footer is a server component, so the dispatching button stays client.
const OPEN_COOKIE_SETTINGS_EVENT = 'erametsad:open-cookie-settings'

export function CookieSettingsButton({ className }: { className: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        document.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT))
      }}
      className={className}
    >
      Küpsisesätted
    </button>
  )
}

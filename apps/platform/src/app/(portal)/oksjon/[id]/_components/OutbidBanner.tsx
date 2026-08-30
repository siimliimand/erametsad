'use client'

// Sticky notice shown while the viewer's earlier leading bid has been
// overtaken (task 4.5). BidList owns the outbid state; the banner is purely
// presentational and disappears once the viewer leads again.
export function OutbidBanner() {
  return (
    <div
      role="status"
      className="sticky top-2 z-10 flex flex-col gap-2xs rounded-card border border-danger/30 bg-dangerLight px-md py-sm shadow-card"
    >
      <p className="text-bodySm font-semibold text-danger">
        Sinu pakkumine pakuti üle
      </p>
      <p className="text-bodySm text-inkMuted">
        Esita uus pakkumine, et oma pakkumisega taas juhtima jääda.
      </p>
    </div>
  )
}

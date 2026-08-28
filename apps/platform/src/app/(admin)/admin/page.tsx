import { requireAdminRepositories } from '../_lib/admin'

interface StatCard {
  label: string
  value: number
}

export default async function AdminDashboardPage() {
  const { repositories } = await requireAdminRepositories()

  const [auctions, activeAuctions, bids, users] = await Promise.all([
    repositories.find({ collection: 'auctions', pagination: false }),
    repositories.find({
      collection: 'auctions',
      where: { status: { equals: 'active' } },
      pagination: false,
    }),
    repositories.find({ collection: 'bids', pagination: false }),
    repositories.find({ collection: 'users', pagination: false }),
  ])

  const stats: StatCard[] = [
    { label: 'Oksjonid kokku', value: auctions.docs.length },
    { label: 'Aktiivsed oksjonid', value: activeAuctions.docs.length },
    { label: 'Pakkumused', value: bids.docs.length },
    { label: 'Kasutajad', value: users.docs.length },
  ]

  return (
    <div>
      <h1 className="font-heading text-h3 font-bold text-ink">Töölaud</h1>
      <p className="mt-xs text-bodySm text-ink-muted">Ülevaade platvormi olulisematest arvudest.</p>
      <div className="mt-md grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-card border border-border bg-bgPage p-md shadow-card"
          >
            <p className="text-label font-semibold text-ink-muted">{stat.label}</p>
            <p className="mt-xs font-mono text-count font-medium text-primaryDark">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

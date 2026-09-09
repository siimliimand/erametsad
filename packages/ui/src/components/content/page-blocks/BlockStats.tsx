import type { StatsBlockConfig } from './types'

export function BlockStats({ config }: { config: StatsBlockConfig }) {
  return (
    <section className="bg-primaryDark">
      <div className="mx-auto max-w-container-xl px-md py-xl md:px-lg">
        {config.heading !== undefined && (
          <h2 className="text-center font-heading text-h3 text-inkInverse">
            {config.heading}
          </h2>
        )}
        <div
          className={`grid gap-lg text-center sm:grid-cols-2 md:grid-cols-3 ${
            config.heading !== undefined ? 'mt-lg' : ''
          }`}
        >
          {config.items.map((item, index) => (
            <div key={[item.label, index].join('-')}>
              <p
                className="font-heading text-h1 text-inkInverse"
                style={{ fontFeatureSettings: '"tnum" 1' }}
              >
                {item.value}
                {item.suffix ?? ''}
              </p>
              <p className="mt-xs text-body text-white/80">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

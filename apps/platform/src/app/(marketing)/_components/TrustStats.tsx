import { unstable_cache } from 'next/cache';

import { computeStats, type StatisticsResult } from '@/lib/stats/aggregation';

// Spec (marketing-home): 24-hour revalidation, hide entirely on failure,
// never render zeros. The page renders at request time, but this read is
// cached independently so the aggregate query does not run per visitor.
const getCachedStats = unstable_cache(
  async (): Promise<StatisticsResult[]> => computeStats(),
  ['avaleht-trust-stats'],
  { revalidate: 86_400 },
);

export async function TrustStats() {
  let rows: StatisticsResult[];
  try {
    rows = await getCachedStats();
  } catch {
    // API unavailable or no D1 binding: the block stays absent, never zeros.
    return null;
  }

  const soldCount = rows.reduce((sum, row) => sum + row.totalCount, 0);
  const soldAreaHa = rows.reduce((sum, row) => sum + row.totalArea, 0);
  const soldEur = rows.reduce((sum, row) => sum + row.totalEur, 0);

  const metrics = [
    { label: 'Müüdud oksjonit', value: soldCount },
    { label: 'Müüdud metsamaad (ha)', value: Math.round(soldAreaHa) },
    { label: 'Kokku müüdud (€)', value: Math.round(soldEur) },
  ].filter((metric) => metric.value > 0);

  if (metrics.length === 0) return null;

  return (
    <section className="bg-primaryDark">
      <div className="mx-auto grid max-w-container-xl gap-lg px-md py-xl text-center md:grid-cols-3 md:px-lg">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <p
              className="font-heading text-h1 text-inkInverse"
              style={{ fontFeatureSettings: '"tnum" 1' }}
            >
              {metric.value.toLocaleString('et-EE')}
            </p>
            <p className="mt-xs text-body text-white/80">{metric.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

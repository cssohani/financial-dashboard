'use client';

import { SearchBar } from '@/src/components/SearchBar';
import { useCompanySnapshot } from '@/src/hooks/useCompanySnapshot';
import { IdentityCard } from '@/src/components/cards/IdentityCard';
import { PriceCard } from '@/src/components/cards/PriceCard';
import { MetricsCard } from '@/src/components/cards/MetricsCard';
import { FinancialHealthCard } from '@/src/components/cards/FinancialHealthCard';
import { PerformanceCard } from '@/src/components/cards/PerformanceCard';

export default function DashboardShell() {
  const { ticker, setTicker, status, data, error, run, canFetch } = useCompanySnapshot();

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4">
          <div>
            <div className="text-xl font-semibold">Mini Financial Research Dashboard</div>
            <div className="text-sm text-zinc-500">
              Search a ticker to view price, key metrics, and performance — fast.
            </div>
          </div>

          <SearchBar
            value={ticker}
            onChange={setTicker}
            onSubmit={() => run()}
            disabled={!canFetch || status === 'loading'}
          />

          {status === 'error' && (
            <div className="rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {status === 'idle' && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-400">
              Tip: press <span className="font-mono text-zinc-200">/</span> to focus the search box.
            </div>
          )}
        </div>

        {status === 'loading' && (
          <div className="text-sm text-zinc-500">Loading snapshot…</div>
        )}

        {data && (
          <>
            <div className="mb-3 text-xs text-zinc-500">
              Fetched: {new Date(data.fetchedAt).toLocaleString()} •{' '}
              {data.meta.cached ? `cached (${data.meta.cacheAgeSeconds}s old)` : 'live'} • source:{' '}
              {data.meta.source}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <IdentityCard data={data} />
              </div>
              <PriceCard data={data} />
              <MetricsCard data={data} />
              <FinancialHealthCard data={data} />
              <PerformanceCard data={data} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

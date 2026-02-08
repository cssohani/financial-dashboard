'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { SearchBar } from '@/src/components/SearchBar';
import { useCompanySnapshot } from '@/src/hooks/useCompanySnapshot';

import { IdentityCard } from '@/src/components/cards/IdentityCard';
import { PriceCard } from '@/src/components/cards/PriceCard';
import { MetricsCard } from '@/src/components/cards/MetricsCard';
import { FinancialHealthCard } from '@/src/components/cards/FinancialHealthCard';
import { PerformanceCard } from '@/src/components/cards/PerformanceCard';
import { CardSkeleton } from '@/src/components/CardSkeleton';
import { EarningsBrief } from '@/src/components/EarningsBrief';
import { PriceChartCard } from '@/src/components/PriceChartCard';






export default function TickerDashboardShell({ initialTicker }: { initialTicker: string }) {
  const router = useRouter();
  const { ticker, setTicker, status, data, error, run, canFetch } = useCompanySnapshot(
    initialTicker
  );

  // Keep URL canonical (uppercase)
  useEffect(() => {
    const sym = (initialTicker || '').trim().toUpperCase();
    if (sym && sym !== initialTicker) router.replace(`/ticker/${sym}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTicker]);

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xl font-semibold">Mini Financial Research Dashboard</div>
              <div className="text-sm text-zinc-500">
                Shareable route: <span className="font-mono">/ticker/{ticker || '...'}</span>
              </div>
            </div>

            <button
              onClick={() => run(undefined, { refresh: true })}
              disabled={status === 'loading' || !canFetch}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
              title="Re-fetch snapshot"
            >
              Refresh
            </button>
          </div>

          <SearchBar
            value={ticker}
            onChange={setTicker}
            onSubmit={() => {
              // push shareable URL on submit
              router.push(`/ticker/${ticker.trim().toUpperCase()}`);
            }}
            disabled={!canFetch || status === 'loading'}
          />

          {status === 'error' && (
            <div className="rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>
        {status === 'loading' && data && (
          <div className="mb-3 text-xs text-zinc-500">
            Refreshing snapshot…
          </div>
        )}

        {status === 'loading' && !data && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CardSkeleton title="IDENTITY" rows={4} />
            </div>
            <CardSkeleton title="PRICE" rows={4} />
            <CardSkeleton title="KEY METRICS" rows={6} />
            <CardSkeleton title="FINANCIAL HEALTH" rows={4} />
            <CardSkeleton title="PERFORMANCE" rows={5} />
          </div>
          )
          }


        {data && (
          <>
            <div className="mb-3 text-xs text-zinc-500">
              Fetched: {new Date(data.fetchedAt).toLocaleString()} •{' '}
              {data.meta.cached ? `cached (${data.meta.cacheAgeSeconds}s old)` : 'live'} • source:{' '}
              {data.meta.source}
            </div>

            <div className="mb-4">
              <PriceChartCard data={data} />
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

            <div className="mt-8">
              <EarningsBrief ticker={data.ticker} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

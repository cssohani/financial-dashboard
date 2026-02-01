'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { SearchBar } from '@/src/components/SearchBar';
import { getRecentTickers, addRecentTicker } from '@/src/lib/recentTickers';


export default function DashboardShell() {
  const router = useRouter();
  const [ticker, setTicker] = useState('');
  const [recents, setRecents] = useState<string[]>([]);

  const canFetch = useMemo(() => /^[A-Z.\-]{1,10}$/.test(ticker.trim().toUpperCase()), [ticker]);

  useEffect(() => {
    setRecents(getRecentTickers());
  }, []);

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="mb-8">
          <div className="text-2xl font-semibold">Mini Financial Research Dashboard</div>
          <div className="mt-2 text-sm text-zinc-500">
            Search a ticker to view price, key metrics, and performance — fast.
          </div>
        </div>

        <SearchBar
          value={ticker}
          onChange={setTicker}
          onSubmit={() => {
            const sym = ticker.trim().toUpperCase();
            addRecentTicker(sym);
            router.push(`/ticker/${sym}`);
          }}
          disabled={!canFetch}
        />

        {recents.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-xs text-zinc-500">Recent</div>
            <div className="flex flex-wrap gap-2">
              {recents.map((t) => (
                <button
                  key={t}
                  onClick={() => router.push(`/ticker/${t}`)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-900"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}


        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-400">
          Tip: press <span className="font-mono text-zinc-200">/</span> to focus the search box.
        </div>
      </div>
    </main>
  );
}

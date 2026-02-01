'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CompanySnapshot } from '@/src/types/company';

type State =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: CompanySnapshot | null; error: null }
  | { status: 'success'; data: CompanySnapshot; error: null }
  | { status: 'error'; data: CompanySnapshot | null; error: string };

async function fetchSnapshot(ticker: string, refresh?: boolean): Promise<CompanySnapshot> {
    const url = refresh
    ? `/api/snapshot?ticker=${encodeURIComponent(ticker)}&refresh=1`
    : `/api/snapshot?ticker=${encodeURIComponent(ticker)}`;

  const res = await fetch(`/api/snapshot?ticker=${encodeURIComponent(ticker)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error || `Request failed (${res.status})`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;

  }
  return (await res.json()) as CompanySnapshot;
}

export function useCompanySnapshot(initialTicker?: string) {
  const [ticker, setTicker] = useState<string>(initialTicker ?? '');
  const [state, setState] = useState<State>({ status: 'idle', data: null, error: null });

  const canFetch = useMemo(() => /^[A-Z.\-]{1,10}$/.test(ticker), [ticker]);

  const run = useCallback(async (overrideTicker?: string, opts?: { refresh?: boolean }) => {
    const sym = (overrideTicker ?? ticker).trim().toUpperCase();
    if (!/^[A-Z.\-]{1,10}$/.test(sym)) {
      setState({ status: 'error', data: null, error: 'Enter a valid ticker (e.g. AAPL).' });
      return;
    }

    setState((prev) => ({ status: 'loading', data: prev.data, error: null }));
    try {
      const data = await fetchSnapshot(sym, opts?.refresh);
      setState({ status: 'success', data, error: null });
    } catch (e: any) {
      const status = e?.status as number | undefined;

      const message =
        status === 429
          ? 'Rate limited by Alpha Vantage (free tier). Wait ~60 seconds, then try again. Avoid rapid refreshes during development.'
          : e?.message || 'Something went wrong.';

      setState((prev) => ({
        status: 'error',
        data: prev.data,
        error: message,
      }));
    }
  }, [ticker]);

  // If you land directly on /ticker/XYZ we want an auto-fetch
  useEffect(() => {
    if (initialTicker) {
      const sym = initialTicker.trim().toUpperCase();
      setTicker(sym);
      void run(sym);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTicker]);

  return {
    ticker,
    setTicker: (t: string) => setTicker(t.toUpperCase()),
    canFetch,
    ...state,
    run,
  };
}

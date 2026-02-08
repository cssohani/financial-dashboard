// frontend/app/api/snapshot/route.ts
import { NextResponse } from 'next/server';
import { getCache, setCache } from '@/src/lib/cache/simpleCache';

export const runtime = 'nodejs';

/**
 * IMPORTANT:
 * Add this to frontend/.env.local
 *   TWELVE_DATA_API_KEY=your_key_here
 */

type CompanySnapshot = {
  ticker: string;
  fetchedAt: string;
  meta: {
    source: string;
    cached: boolean;
    cacheAgeSeconds: number;
    notes?: string[];
  };

  profile: {
    name: string | null;
    description: string | null;
    sector: string | null;
    industry: string | null;
    exchange: string | null;
    marketCap: number | null;
    currency: string | null;
  };

  price: {
    price: number | null;
    change: number | null;
    changePercent: number | null; // fraction: 0.0123 = 1.23%
    open: number | null;
    high: number | null;
    low: number | null;
    volume: number | null;
    latestTradingDay: string | null; // YYYY-MM-DD
  };

  metrics: {
    peRatio: number | null;
    eps: number | null;
    profitMargin: number | null; // fraction
    operatingMargin: number | null; // fraction
    roe: number | null; // fraction
    debtToEquity: number | null;
    revenueTTM: number | null;
    grossProfitTTM: number | null;
  };

  performance: {
    return1M: number | null; // fraction
    return6M: number | null; // fraction
    return1Y: number | null; // fraction
    high52W: number | null;
    low52W: number | null;
  };

  priceHistory1Y: Array<{ date: string; close: number }>;
};

type TDErrorResponse = {
  status?: 'error';
  code?: number | string;
  message?: string;
};

type TDQuoteResponse = {
  status?: 'ok' | 'error';
  symbol?: string;
  name?: string;
  exchange?: string;
  currency?: string;

  datetime?: string; // often "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss"
  close?: string;
  open?: string;
  high?: string;
  low?: string;
  volume?: string;

  previous_close?: string;
  change?: string;
  percent_change?: string; // e.g. "1.23"
} & TDErrorResponse;

type TDTimeSeriesValue = {
  datetime: string; // "YYYY-MM-DD"
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
};

type TDTimeSeriesResponse = {
  status?: 'ok' | 'error';
  meta?: {
    symbol?: string;
    name?: string;
    exchange?: string;
    currency?: string;
  };
  values?: TDTimeSeriesValue[];
} & TDErrorResponse;

type TDProfileResponse = {
  status?: 'ok' | 'error';
  symbol?: string;
  name?: string;
  exchange?: string;
  currency?: string;
  industry?: string;
  sector?: string;
  description?: string;
  market_cap?: string | number;
} & TDErrorResponse;

type TDStatisticsResponse = {
  status?: 'ok' | 'error';
  // Statistics fields vary by plan/coverage; treat as unknown bag and pick what we can
  [k: string]: unknown;
} & TDErrorResponse;

function requireTwelveKey(): string {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) throw new Error('Missing TWELVE_DATA_API_KEY (set it in frontend/.env.local)');
  return key;
}

function twelveUrl(path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(`https://api.twelvedata.com${path}`);
  url.searchParams.set('apikey', requireTwelveKey());
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function fetchTDJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as any;

  // Twelve Data often returns 200 with {status:"error", message: "..."}
  if (!res.ok || json?.status === 'error') {
    const msg = json?.message || `Twelve Data request failed (${res.status})`;
    throw new Error(msg);
  }

  return json as T;
}

async function tryFetchTDJson<T>(url: string): Promise<T | null> {
  try {
    return await fetchTDJson<T>(url);
  } catch {
    return null;
  }
}

function validateTicker(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  if (!/^[A-Z.\-]{1,15}$/.test(t)) return null;
  return t;
}

function toISODate(d: string | undefined | null): string | null {
  if (!d) return null;
  // "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DD"
  return d.slice(0, 10);
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fracFromPercent(v: unknown): number | null {
  const n = num(v);
  if (n === null) return null;
  return n / 100;
}

function pickNumber(obj: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    const n = num(v);
    if (n !== null) return n;
  }
  return null;
}

function computeReturn(closes: number[], lookback: number): number | null {
  if (!closes?.length || closes.length < lookback + 1) return null;
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - lookback];
  if (!Number.isFinite(last) || !Number.isFinite(prev) || prev === 0) return null;
  return (last - prev) / prev;
}

function highLow(arr: number[]): { high: number | null; low: number | null } {
  const vals = arr.filter((x) => Number.isFinite(x));
  if (!vals.length) return { high: null, low: null };
  const hi = Math.max(...vals);
  const lo = Math.min(...vals);
  return {
    high: Number.isFinite(hi) ? hi : null,
    low: Number.isFinite(lo) ? lo : null,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawTicker = searchParams.get('ticker') ?? '';
  const refresh = searchParams.get('refresh') === '1';

  const ticker = validateTicker(rawTicker);
  if (!ticker) {
    return NextResponse.json({ error: 'Invalid ticker.' }, { status: 400 });
  }

  // Cache longer to avoid burning credits while developing
  const cacheKey = `snapshot:twelvedata:v1:${ticker}`;
  if (!refresh) {
    const cached = getCache<CompanySnapshot>(cacheKey);
    if (cached.hit) {
      return NextResponse.json({
        ...cached.value,
        meta: {
          ...cached.value.meta,
          cached: true,
          cacheAgeSeconds: cached.ageSeconds,
        },
      });
    }
  }

  const notes: string[] = [];

  try {
    // Market data (generally available on free plans)
    const quoteUrl = twelveUrl('/quote', { symbol: ticker });
    const tsUrl = twelveUrl('/time_series', {
      symbol: ticker,
      interval: '1day',
      outputsize: 260, // ~1 trading year
      format: 'JSON',
    });

    // Fundamentals/metrics (availability depends on plan). We'll try, but won't fail snapshot if blocked.
    const profileUrl = twelveUrl('/profile', { symbol: ticker });
    const statsUrl = twelveUrl('/statistics', { symbol: ticker });

    const [quote, ts, profile, stats] = await Promise.all([
      fetchTDJson<TDQuoteResponse>(quoteUrl),
      fetchTDJson<TDTimeSeriesResponse>(tsUrl),
      tryFetchTDJson<TDProfileResponse>(profileUrl),
      tryFetchTDJson<TDStatisticsResponse>(statsUrl),
    ]);

    const values = Array.isArray(ts.values) ? ts.values : [];
    if (!values.length) {
      notes.push('missing_price_history');
    }

    // Twelve Data returns values newest -> oldest; we want oldest -> newest for charting
    const history = values
      .map((v) => ({
        date: v.datetime?.slice(0, 10),
        close: num(v.close),
        high: num(v.high),
        low: num(v.low),
      }))
      .filter((p): p is { date: string; close: number; high: number | null; low: number | null } => {
        return Boolean(p.date) && p.close !== null;
      })
      .reverse();

    const priceHistory1Y = history.map((p) => ({ date: p.date, close: p.close }));

    const closes = history.map((p) => p.close);
    const highs = history.map((p) => p.high ?? NaN);
    const lows = history.map((p) => p.low ?? NaN);

    const { high: high52W, low: low52W } = highLow(
      highs.filter((x) => Number.isFinite(x)) as number[]
    );

    // Approximate trading-day lookbacks
    const return1M = computeReturn(closes, 21);
    const return6M = computeReturn(closes, 126);
    const return1Y = closes.length >= 2 ? computeReturn(closes, closes.length - 1) : null;

    // Profile fields (if available)
    const profileName = profile?.name ?? ts.meta?.name ?? quote?.name ?? null;
    const profileExchange = profile?.exchange ?? ts.meta?.exchange ?? quote?.exchange ?? null;
    const profileCurrency = profile?.currency ?? ts.meta?.currency ?? quote?.currency ?? null;

    const marketCap =
      num(profile?.market_cap) ??
      // some statistics payloads expose market cap under keys like "market_capitalization"
      pickNumber(stats as any, ['market_cap', 'market_capitalization', 'marketCapitalization']) ??
      null;

    // Metrics (best-effort): depends on plan & symbol coverage
    const peRatio = pickNumber(stats as any, ['pe_ratio', 'pe', 'pe_ttm', 'peTTM']);
    const eps = pickNumber(stats as any, ['eps', 'eps_ttm', 'epsTTM', 'eps_diluted_ttm']);
    const profitMargin =
      pickNumber(stats as any, ['profit_margin', 'net_margin', 'netMargin']) ??
      null;
    const operatingMargin =
      pickNumber(stats as any, ['operating_margin', 'operating_margin_ttm', 'operatingMarginTTM']) ??
      null;
    const roe = pickNumber(stats as any, ['roe', 'roe_ttm', 'roeTTM']) ?? null;
    const debtToEquity =
      pickNumber(stats as any, ['debt_to_equity', 'debtToEquity', 'total_debt_to_equity']) ?? null;
    const revenueTTM = pickNumber(stats as any, ['revenue_ttm', 'revenueTTM']) ?? null;
    const grossProfitTTM = pickNumber(stats as any, ['gross_profit_ttm', 'grossProfitTTM']) ?? null;

    if (!profile) notes.push('profile_unavailable');
    if (!stats) notes.push('statistics_unavailable');

    const latestTradingDay =
      toISODate(quote?.datetime) ??
      (priceHistory1Y.length ? priceHistory1Y[priceHistory1Y.length - 1].date : null);

    const snapshot: CompanySnapshot = {
      ticker,
      fetchedAt: new Date().toISOString(),
      meta: {
        source: 'Twelve Data',
        cached: false,
        cacheAgeSeconds: 0,
        notes: notes.length ? notes : undefined,
      },

      profile: {
        name: profileName,
        description: (profile as any)?.description ?? null,
        sector: (profile as any)?.sector ?? null,
        industry: (profile as any)?.industry ?? null,
        exchange: profileExchange,
        marketCap,
        currency: profileCurrency,
      },

      price: {
        price: num(quote?.close),
        change: num(quote?.change),
        changePercent: fracFromPercent(quote?.percent_change),
        open: num(quote?.open),
        high: num(quote?.high),
        low: num(quote?.low),
        volume: num(quote?.volume),
        latestTradingDay,
      },

      metrics: {
        peRatio,
        eps,
        profitMargin,
        operatingMargin,
        roe,
        debtToEquity,
        revenueTTM,
        grossProfitTTM,
      },

      performance: {
        return1M,
        return6M,
        return1Y,
        high52W,
        low52W,
      },

      priceHistory1Y,
    };

    // Cache for 1 hour to reduce API credits usage during dev
    // Only cache if we have enough history to be meaningful
    if (priceHistory1Y.length >= 30) {
      setCache(cacheKey, snapshot, 60 * 60 * 1000);
    }

    return NextResponse.json(snapshot);
  } catch (e: any) {
    const msg = e?.message || 'Snapshot failed.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

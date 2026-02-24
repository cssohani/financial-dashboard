// frontend/app/api/snapshot/route.ts
import { NextResponse } from 'next/server';
import { getCache, setCache } from '@/src/lib/cache/simpleCache';

export const runtime = 'nodejs';

/**
 * Requires:
 *   TWELVE_DATA_API_KEY=...
 * in frontend/.env.local
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
    previousClose: number | null;
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

  datetime?: string; // "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss"
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
  // Often: { meta: {...}, values: {...}, status: "ok" }
  meta?: unknown;
  values?: unknown;
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

  // Twelve Data sometimes returns 200 + {status:"error", message:"..."}
  if (!res.ok || json?.status === 'error') {
    const msg = json?.message || `Twelve Data request failed (${res.status})`;
    throw new Error(msg);
  }

  return json as T;
}

async function tryFetchTDJson<T>(url: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await fetchTDJson<T>(url);
    return { data, error: null };
  } catch (e: any) {
    return { data: null, error: e?.message || 'Unknown error' };
  }
}

function validateTicker(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  if (!/^[A-Z.\-]{1,15}$/.test(t)) return null;
  return t;
}

function toISODate(d: string | undefined | null): string | null {
  if (!d) return null;
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

function pickNumber(obj: any, keys: string[]): number | null {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    const n = num(obj[k]);
    if (n !== null) return n;
  }
  return null;
}

function pickPathNumber(obj: any, paths: string[]): number | null {
  if (!obj || typeof obj !== 'object') return null;
  for (const path of paths) {
    let cur: any = obj;
    const parts = path.split('.');
    let ok = true;
    for (const p of parts) {
      if (!cur || typeof cur !== 'object' || !(p in cur)) {
        ok = false;
        break;
      }
      cur = cur[p];
    }
    if (!ok) continue;
    const n = num(cur);
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

  // Bump this version whenever you change mapping to avoid stale cached snapshots
  const cacheKey = `snapshot:twelvedata:v4:${ticker}`;

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
    // Market data
    const quoteUrl = twelveUrl('/quote', { symbol: ticker });
    const tsUrl = twelveUrl('/time_series', {
      symbol: ticker,
      interval: '1day',
      outputsize: 260, // ~1 trading year
      format: 'JSON',
    });

    // Fundamentals (Pro plan supports these)
    const profileUrl = twelveUrl('/profile', { symbol: ticker });
    const statsUrl = twelveUrl('/statistics', { symbol: ticker });

    
    const [quote, ts, profileRes, statsRes] = await Promise.all([
      fetchTDJson<TDQuoteResponse>(quoteUrl),
      fetchTDJson<TDTimeSeriesResponse>(tsUrl),
      tryFetchTDJson<TDProfileResponse>(profileUrl),
      tryFetchTDJson<TDStatisticsResponse>(statsUrl),
    ]);

    const profile = profileRes.data;
    const stats = statsRes.data;

    if (!profile && profileRes.error) notes.push(`profile_error:${profileRes.error}`);
    if (!stats && statsRes.error) notes.push(`statistics_error:${statsRes.error}`);
    console.log('STATS RAW:', JSON.stringify(stats, null, 2));
    const values = Array.isArray(ts.values) ? ts.values : [];
    if (!values.length) notes.push('missing_price_history');

    // Twelve Data returns newest -> oldest; convert to oldest -> newest
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

    // Use highs if present; otherwise fall back to closes
    const highs = history.map((p) => p.high ?? p.close);
    const { high: high52W, low: low52W } = highLow(highs);

    const return1M = computeReturn(closes, 21);
    const return6M = computeReturn(closes, 126);
    const return1Y = closes.length >= 2 ? computeReturn(closes, closes.length - 1) : null;

    // Profile fields
    const profileName = profile?.name ?? ts.meta?.name ?? quote?.name ?? null;
    const profileExchange = profile?.exchange ?? ts.meta?.exchange ?? quote?.exchange ?? null;
    const profileCurrency = profile?.currency ?? ts.meta?.currency ?? quote?.currency ?? null;

    // ---- THIS IS THE KEY FIX FOR KEY METRICS ----
    // Twelve Data statistics is commonly nested under { values: {...} }
    const statsRoot: any = stats as any;
    const statsValues = statsRoot?.statistics ?? statsRoot?.values ?? statsRoot;

    // Market Cap
    const marketCap =
      num(profile?.market_cap) ??
      pickPathNumber(statsValues, ['valuations_metrics.market_capitalization']) ??
      pickNumber(statsValues, ['market_cap', 'market_capitalization', 'marketCapitalization']) ??
      null;

    // Key Metrics + Financial Health
    const peRatio =
      pickPathNumber(statsValues, ['valuations_metrics.trailing_pe', 'valuations_metrics.forward_pe']) ??
      pickNumber(statsValues, ['trailing_pe', 'forward_pe', 'pe_ratio', 'pe', 'pe_ttm', 'peTTM']) ??
      null;

    const eps =
      pickPathNumber(statsValues, ['financials.income_statement.diluted_eps_ttm']) ??
      pickNumber(statsValues, ['diluted_eps_ttm', 'eps', 'eps_ttm', 'epsTTM', 'eps_diluted_ttm']) ??
      null;

    const profitMargin =
      pickPathNumber(statsValues, ['financials.profit_margin']) ??
      pickNumber(statsValues, ['profit_margin', 'profitMargins', 'net_margin', 'netMargin']) ??
      null;

    const operatingMargin =
      pickPathNumber(statsValues, ['financials.operating_margin']) ??
      pickNumber(statsValues, ['operating_margin', 'operatingMargins', 'operating_margin_ttm', 'operatingMarginTTM']) ??
      null;

    const roe =
      pickPathNumber(statsValues, ['financials.return_on_equity_ttm']) ??
      pickNumber(statsValues, ['return_on_equity_ttm', 'roe', 'roe_ttm', 'roeTTM', 'returnOnEquity']) ??
      null;

    const debtToEquity =
      pickPathNumber(statsValues, ['financials.balance_sheet.total_debt_to_equity_mrq']) ??
      pickNumber(statsValues, ['total_debt_to_equity_mrq', 'debt_to_equity', 'debtToEquity', 'total_debt_to_equity']) ??
      null;

    const revenueTTM =
      pickPathNumber(statsValues, ['financials.income_statement.revenue_ttm']) ??
      pickNumber(statsValues, ['revenue_ttm', 'revenueTTM', 'total_revenue']) ??
      null;

    const grossProfitTTM =
      pickPathNumber(statsValues, ['financials.income_statement.gross_profit_ttm']) ??
      pickNumber(statsValues, ['gross_profit_ttm', 'grossProfitTTM', 'gross_profits']) ??
      null;

    if (!profile) notes.push('profile_unavailable');
    if (!stats) notes.push('statistics_unavailable');

    const latestTradingDay =
      toISODate(quote?.datetime) ?? (priceHistory1Y.length ? priceHistory1Y[priceHistory1Y.length - 1].date : null);

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
        previousClose: num(quote?.previous_close),
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

    
    if (priceHistory1Y.length >= 30) {
      if (stats) {
        setCache(cacheKey, snapshot, 60 * 60 * 1000);
      } else {
        // short cache to avoid hammering API during rapid typing, but allow quick recovery
        setCache(cacheKey, snapshot, 2 * 60 * 1000);
      }
    }

    return NextResponse.json(snapshot);
  } catch (e: any) {
    const msg = e?.message || 'Snapshot failed.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
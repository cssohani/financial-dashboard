import { NextResponse } from 'next/server';
import { avUrl } from '@/src/lib/alphavantage/urls';
import { fetchJson } from '@/src/lib/alphavantage/fetchJson';
import { getCache, setCache } from '@/src/lib/cache/simpleCache';
import type { CompanySnapshot } from '@/src/types/company';

type GlobalQuoteResponse = {
  'Global Quote'?: Record<string, string>;
  Note?: string;
  Information?: string;
  'Error Message'?: string;
};

type OverviewResponse = Record<string, string> & {
  Note?: string;
  Information?: string;
  'Error Message'?: string;
};

type WeeklyAdjustedResponse = {
  'Weekly Adjusted Time Series'?: Record<string, Record<string, string>>;
  Note?: string;
  Information?: string;
  'Error Message'?: string;
};

function isRateLimited(obj: any): boolean {
  return typeof obj?.Note === 'string' && obj.Note.toLowerCase().includes('call frequency');
}

function parseNum(x: string | undefined): number | null {
  if (!x) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function parsePercent(x: string | undefined): number | null {
  if (!x) return null;
  const cleaned = x.replace('%', '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n / 100 : null;
}

function computeReturnsFromWeekly(series: Record<string, Record<string, string>> | undefined) {
  if (!series) {
    return { return1M: null, return6M: null, return1Y: null, high52W: null, low52W: null };
  }

  const dates = Object.keys(series).sort((a, b) => (a > b ? -1 : 1));

  const closes = dates
    .map((d) => ({
      date: d,
      adjClose: parseNum(series[d]['5. adjusted close']),
    }))
    .filter((x): x is { date: string; adjClose: number } => x.adjClose !== null);

  if (closes.length < 10) {
    return { return1M: null, return6M: null, return1Y: null, high52W: null, low52W: null };
  }

  const latest = closes[0].adjClose;

  const pickClosest = (weeksBack: number): number | null => {
    const idx = Math.min(weeksBack, closes.length - 1);
    return closes[idx]?.adjClose ?? null;
  };

  // Weekly: ~4 weeks = 1M, ~26 weeks = 6M, ~52 weeks = 1Y
  const m1 = pickClosest(4);
  const m6 = pickClosest(26);
  const y1 = pickClosest(52);

  const ret = (past: number | null) => (past ? (latest - past) / past : null);

  const last52 = closes.slice(0, Math.min(53, closes.length)).map((x) => x.adjClose);
  const high52W = last52.length ? Math.max(...last52) : null;
  const low52W = last52.length ? Math.min(...last52) : null;

  return {
    return1M: ret(m1),
    return6M: ret(m6),
    return1Y: ret(y1),
    high52W,
    low52W,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get('refresh') === '1';
  const rawTicker = (searchParams.get('ticker') || '').trim().toUpperCase();

  // Basic ticker validation (US-style). You can loosen later.
  if (!/^[A-Z.\-]{1,10}$/.test(rawTicker)) {
    return NextResponse.json({ error: 'Invalid ticker format' }, { status: 400 });
  }

  const cacheKey = `snapshot:v1:${rawTicker}`;
  const cached = getCache<CompanySnapshot>(cacheKey);

  if (!refresh) {
    const cached = getCache<CompanySnapshot>(cacheKey);
    if (cached.hit) {
      return NextResponse.json({
        ...cached.value,
        meta: { ...cached.value.meta, cached: true, cacheAgeSeconds: cached.ageSeconds },
      });
    }
  }


  const notes: string[] = [];

  const [quote, overview, weekly] = await Promise.all([
    fetchJson<GlobalQuoteResponse>(avUrl('GLOBAL_QUOTE', rawTicker)),
    fetchJson<OverviewResponse>(avUrl('OVERVIEW', rawTicker)),
    fetchJson<WeeklyAdjustedResponse>(avUrl('TIME_SERIES_WEEKLY_ADJUSTED', rawTicker)),
  ]);

  if (isRateLimited(quote) || isRateLimited(overview) || isRateLimited(weekly)) {
    notes.push('rate_limited');
    return NextResponse.json(
      { error: 'Rate limited by Alpha Vantage. Try again shortly.' },
      { status: 429 }
    );
  }

  if (quote['Error Message'] || overview['Error Message'] || weekly['Error Message']) {
    return NextResponse.json({ error: 'Ticker not found or invalid API call.' }, { status: 404 });
  }

  const q = quote['Global Quote'] || {};
  const perf = computeReturnsFromWeekly(weekly['Weekly Adjusted Time Series']);

  const snapshot: CompanySnapshot = {
    ticker: rawTicker,
    fetchedAt: new Date().toISOString(),

    profile: {
      name: overview.Name ?? null,
      description: overview.Description ?? null,
      sector: overview.Sector ?? null,
      industry: overview.Industry ?? null,
      exchange: overview.Exchange ?? null,
      currency: overview.Currency ?? null,
      marketCap: parseNum(overview.MarketCapitalization),
    },

    price: {
      price: parseNum(q['05. price']),
      change: parseNum(q['09. change']),
      changePercent: parsePercent(q['10. change percent']),
      previousClose: parseNum(q['08. previous close']),
      open: parseNum(q['02. open']),
      high: parseNum(q['03. high']),
      low: parseNum(q['04. low']),
      volume: parseNum(q['06. volume']),
      latestTradingDay: q['07. latest trading day'] ?? null,
    },

    metrics: {
      peRatio: parseNum(overview.PERatio),
      eps: parseNum(overview.EPS),
      profitMargin: parseNum(overview.ProfitMargin),
      operatingMargin: parseNum(overview.OperatingMarginTTM),
      roe: parseNum(overview.ReturnOnEquityTTM),
      debtToEquity: parseNum(overview.DebtToEquity),
      revenueTTM: parseNum(overview.RevenueTTM),
      grossProfitTTM: parseNum(overview.GrossProfitTTM),
    },

    performance: perf,

    meta: {
      source: 'alphavantage',
      cached: false,
      cacheAgeSeconds: null,
      notes,
    },
  };

  // Keep snapshot cached for 2 minutes to reduce hammering
  setCache(cacheKey, snapshot, 2 * 60 * 1000);

  return NextResponse.json(snapshot);
}

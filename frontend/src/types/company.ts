export type CompanySnapshot = {
  priceHistory1Y: Array<{
    date: string; // YYYY-MM-DD
    close: number;
  }>;

  ticker: string;
  fetchedAt: string; // ISO timestamp

  profile: {
    name: string | null;
    description: string | null;
    sector: string | null;
    industry: string | null;
    exchange: string | null;
    currency: string | null;
    marketCap: number | null;
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

  meta: {
    source: 'twelvedata' | 'Twelve Data' | string;
    cached: boolean;
    cacheAgeSeconds: number;
    notes?: string[];
  };
};
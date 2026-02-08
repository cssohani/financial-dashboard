export type CompanySnapshot = {
  priceHistory1Y: Array<{
    date: string;  // YYYY-MM-DD
    close: number; // adjusted close
  }>; 

  ticker: string;
  fetchedAt: string; // ISO timestamp (server time)

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
    changePercent: number | null;
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
    profitMargin: number | null;
    operatingMargin: number | null;
    roe: number | null;
    debtToEquity: number | null;
    revenueTTM: number | null;
    grossProfitTTM: number | null;
  };

  performance: {
    return1M: number | null;
    return6M: number | null;
    return1Y: number | null;
    high52W: number | null;
    low52W: number | null;
  };

  meta: {
    source: 'alphavantage';
    cached: boolean;
    cacheAgeSeconds: number | null;
    notes: string[]; // e.g. "rate_limited", "missing_overview"
  };
};

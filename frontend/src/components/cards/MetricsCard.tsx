import { InfoCard } from '@/src/components/InfoCard';
import { StatRow } from '@/src/components/StatRow';
import type { CompanySnapshot } from '@/src/types/company';
import { formatNumber, formatPercent } from '@/src/lib/format/numbers';

function mean(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
}

function stddev(nums: number[]) {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  const v = mean(nums.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

function movingAverage(closes: number[], n: number): number | null {
  if (closes.length < n) return null;
  const slice = closes.slice(-n);
  return mean(slice);
}

function percentFrom(a: number, b: number): number | null {
  // return (b - a) / a
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return (b - a) / a;
}

function maxDrawdown(closes: number[]): number | null {
  if (closes.length < 2) return null;
  let peak = closes[0];
  let mdd = 0;

  for (const c of closes) {
    if (c > peak) peak = c;
    const dd = peak > 0 ? (peak - c) / peak : 0;
    if (dd > mdd) mdd = dd;
  }
  return Number.isFinite(mdd) ? mdd : null; // fraction (0.2 = 20%)
}

function ytdReturn(points: Array<{ date: string; close: number }>): number | null {
  if (!points.length) return null;
  const last = points[points.length - 1];
  const year = last.date.slice(0, 4);

  // first close from the same calendar year
  const first = points.find((p) => p.date.slice(0, 4) === year);
  if (!first) return null;

  return percentFrom(first.close, last.close);
}

export function MetricsCard({ data }: { data: CompanySnapshot }) {
  const history = Array.isArray(data.priceHistory1Y) ? data.priceHistory1Y : [];
  const closes = history.map((p) => p.close).filter((x) => Number.isFinite(x));
  const current = data.price?.price ?? (closes.length ? closes[closes.length - 1] : null);

  const ma50 = closes.length ? movingAverage(closes, 50) : null;
  const ma200 = closes.length ? movingAverage(closes, 200) : null;

  const above50 = current !== null && ma50 !== null ? percentFrom(ma50, current) : null; // (current - ma50)/ma50
  const above200 = current !== null && ma200 !== null ? percentFrom(ma200, current) : null;

  // 30D annualized volatility from daily simple returns
  const last31 = closes.length >= 31 ? closes.slice(-31) : [];
  const dailyReturns =
    last31.length >= 2
      ? last31.slice(1).map((c, i) => {
          const prev = last31[i];
          return prev ? (c - prev) / prev : 0;
        })
      : [];
  const vol30 = dailyReturns.length >= 10 ? stddev(dailyReturns) * Math.sqrt(252) : null;

  const ytd = ytdReturn(history);
  const mdd = closes.length >= 20 ? maxDrawdown(closes) : null;

  const high52 = data.performance?.high52W ?? null;
  const low52 = data.performance?.low52W ?? null;
  const range52 = high52 !== null && low52 !== null && low52 !== 0 ? (high52 - low52) / low52 : null;

  return (
    <InfoCard title="MARKET METRICS">
 

      <StatRow label="52W Range" value={formatPercent(range52, 2)} />
      <StatRow label="Max Drawdown (1Y)" value={formatPercent(mdd === null ? null : -mdd, 2)} />

      <StatRow label="Volatility (30D ann.)" value={formatPercent(vol30, 2)} />
      <StatRow label="Above 50D MA" value={formatPercent(above50, 2)} />
      <StatRow label="Above 200D MA" value={formatPercent(above200, 2)} />

      
    </InfoCard>
  );
}
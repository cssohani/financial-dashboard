import { InfoCard } from '@/src/components/InfoCard';
import { StatRow } from '@/src/components/StatRow';
import type { CompanySnapshot } from '@/src/types/company';
import { formatMoney, formatPercent } from '@/src/lib/format/numbers';


function percentFrom(a: number, b: number): number | null {
  // return (b - a) / a
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return (b - a) / a;
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
export function PerformanceCard({ data }: { data: CompanySnapshot }) {
  const history = Array.isArray(data.priceHistory1Y) ? data.priceHistory1Y : [];
   const ytd = ytdReturn(history);

  const perf = data.performance;
  const currency = data.profile.currency ?? 'USD';

  return (
    <InfoCard title="PERFORMANCE">
      <StatRow label="1M Return" value={formatPercent(perf.return1M, 2)} />
      <StatRow label="6M Return" value={formatPercent(perf.return6M, 2)} />
      <StatRow label="1Y Return" value={formatPercent(perf.return1Y, 2)} />
      <StatRow label="Return (YTD)" value={formatPercent(ytd, 2)} />
      <div className="my-2 border-t border-zinc-800" />
      <StatRow label="52W High" value={formatMoney(perf.high52W, currency)} />
      <StatRow label="52W Low" value={formatMoney(perf.low52W, currency)} />
    </InfoCard>
  );
}

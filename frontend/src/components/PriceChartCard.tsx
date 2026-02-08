'use client';

import { InfoCard } from '@/src/components/InfoCard';
import type { CompanySnapshot } from '@/src/types/company';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

function formatCompactMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDateShort(date: string) {
  // YYYY-MM-DD -> e.g. Jan 24
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

export function PriceChartCard({ data }: { data: CompanySnapshot }) {
  const points = data.priceHistory1Y;

    console.log('history points', data.priceHistory1Y?.length, data.priceHistory1Y?.[0]);

  if (!points || points.length < 5) {
    return (
      <InfoCard title="1Y PRICE">
        <div className="text-sm text-zinc-400">Not enough price history to plot.</div>
      </InfoCard>
    );
  }

  const first = points[0].close;
  const last = points[points.length - 1].close;
  const change = last - first;
  const changePct = first ? change / first : 0;

  return (
    
    <InfoCard title="1Y PRICE">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div className="text-sm text-zinc-400">
          {points[0].date} → {points[points.length - 1].date}
        </div>
        <div className="text-sm tabular-nums text-zinc-100">
          {change >= 0 ? '+' : ''}
          {formatCompactMoney(change)} ({changePct >= 0 ? '+' : ''}
          {(changePct * 100).toFixed(2)}%)
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => formatCompactMoney(v as number)}
              domain={['auto', 'auto']}
            />
            <Tooltip
              formatter={(v) => [formatCompactMoney(v as number), 'Adj Close']}
              labelFormatter={(label) => label}
            />
            <Line
              type="monotone"
              dataKey="close"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </InfoCard>
  );
}

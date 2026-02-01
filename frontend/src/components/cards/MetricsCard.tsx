import { InfoCard } from '@/src/components/InfoCard';
import { StatRow } from '@/src/components/StatRow';
import type { CompanySnapshot } from '@/src/types/company';
import { formatNumber, formatPercent } from '@/src/lib/format/numbers';

export function MetricsCard({ data }: { data: CompanySnapshot }) {
  const m = data.metrics;

  return (
    <InfoCard title="KEY METRICS">
      <StatRow label="P/E (TTM)" value={formatNumber(m.peRatio, 2)} />
      <StatRow label="EPS (TTM)" value={formatNumber(m.eps, 2)} />
      <StatRow label="Profit Margin" value={formatPercent(m.profitMargin, 2)} />
      <StatRow label="Operating Margin" value={formatPercent(m.operatingMargin, 2)} />
      <StatRow label="ROE" value={formatPercent(m.roe, 2)} />
      <StatRow label="Debt / Equity" value={formatNumber(m.debtToEquity, 2)} />
    </InfoCard>
  );
}

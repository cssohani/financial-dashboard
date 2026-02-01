import { InfoCard } from '@/src/components/InfoCard';
import { StatRow } from '@/src/components/StatRow';
import type { CompanySnapshot } from '@/src/types/company';
import { formatMoney, formatPercent } from '@/src/lib/format/numbers';

export function PerformanceCard({ data }: { data: CompanySnapshot }) {
  const perf = data.performance;
  const currency = data.profile.currency ?? 'USD';

  return (
    <InfoCard title="PERFORMANCE">
      <StatRow label="1M Return" value={formatPercent(perf.return1M, 2)} />
      <StatRow label="6M Return" value={formatPercent(perf.return6M, 2)} />
      <StatRow label="1Y Return" value={formatPercent(perf.return1Y, 2)} />
      <div className="my-2 border-t border-zinc-800" />
      <StatRow label="52W High" value={formatMoney(perf.high52W, currency)} />
      <StatRow label="52W Low" value={formatMoney(perf.low52W, currency)} />
    </InfoCard>
  );
}

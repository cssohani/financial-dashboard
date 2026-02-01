import { InfoCard } from '@/src/components/InfoCard';
import { StatRow } from '@/src/components/StatRow';
import type { CompanySnapshot } from '@/src/types/company';
import { formatBigMoney } from '@/src/lib/format/numbers';

export function FinancialHealthCard({ data }: { data: CompanySnapshot }) {
  const m = data.metrics;
  const currency = data.profile.currency ?? 'USD';

  return (
    <InfoCard title="FINANCIAL HEALTH">
      <StatRow label="Revenue (TTM)" value={formatBigMoney(m.revenueTTM, currency)} />
      <StatRow label="Gross Profit (TTM)" value={formatBigMoney(m.grossProfitTTM, currency)} />

      <div className="mt-3 text-xs text-zinc-600">
        Note: Alpha Vantage’s Overview fields can be missing for some tickers. The UI is built to degrade
        gracefully.
      </div>
    </InfoCard>
  );
}

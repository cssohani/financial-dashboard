import { InfoCard } from '@/src/components/InfoCard';
import { StatRow } from '@/src/components/StatRow';
import type { CompanySnapshot } from '@/src/types/company';
import { formatBigMoney } from '@/src/lib/format/numbers';

export function IdentityCard({ data }: { data: CompanySnapshot }) {
  const c = data.profile;
  const currency = c.currency ?? 'USD';

  return (
    <InfoCard title="IDENTITY">
      <div className="mb-3">
        <div className="text-lg font-semibold text-zinc-100">
          {c.name ?? data.ticker}
          <span className="ml-2 text-sm font-normal text-zinc-500">{data.ticker}</span>
        </div>
        <div className="mt-1 line-clamp-3 text-sm text-zinc-400">{c.description ?? '—'}</div>
      </div>

      <StatRow label="Sector" value={c.sector ?? '—'} />
      <StatRow label="Industry" value={c.industry ?? '—'} />
      <StatRow label="Exchange" value={c.exchange ?? '—'} />
      <StatRow label="Market Cap" value={formatBigMoney(c.marketCap, currency)} />
    </InfoCard>
  );
}

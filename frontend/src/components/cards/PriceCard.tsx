import { InfoCard } from '@/src/components/InfoCard';
import { StatRow } from '@/src/components/StatRow';
import type { CompanySnapshot } from '@/src/types/company';
import { formatMoney, formatPercent } from '@/src/lib/format/numbers';

export function PriceCard({ data }: { data: CompanySnapshot }) {
  const p = data.price;
  const currency = data.profile.currency ?? 'USD';

  const change = p.change ?? null;
  const changePct = p.changePercent ?? null;
  const changeText =
    change === null || changePct === null
      ? '—'
      : `${change >= 0 ? '+' : ''}${formatMoney(change, currency)} (${changePct >= 0 ? '+' : ''}${formatPercent(
          changePct
        )})`;

  return (
    <InfoCard title="PRICE">
      <div className="mb-3">
        <div className="text-3xl font-semibold tabular-nums text-zinc-100">
          {formatMoney(p.price, currency)}
        </div>
        <div className="mt-1 text-sm text-zinc-400 tabular-nums">{changeText}</div>
        <div className="mt-1 text-xs text-zinc-600">Latest: {p.latestTradingDay ?? '—'}</div>
      </div>

      <StatRow label="Open" value={formatMoney(p.open, currency)} />
      <StatRow label="High" value={formatMoney(p.high, currency)} />
      <StatRow label="Low" value={formatMoney(p.low, currency)} />
      <StatRow label="Volume" value={p.volume?.toLocaleString() ?? '—'} />
    </InfoCard>
  );
}

export function formatNumber(n: number | null, digits = 2): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function formatInt(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function formatMoney(n: number | null, currency = 'USD'): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatBigMoney(n: number | null, currency = 'USD'): string {
  if (n === null || !Number.isFinite(n)) return '—';

  const abs = Math.abs(n);
  const units = [
    { v: 1e12, s: 'T' },
    { v: 1e9, s: 'B' },
    { v: 1e6, s: 'M' },
    { v: 1e3, s: 'K' },
  ];

  for (const u of units) {
    if (abs >= u.v) {
      return `${formatMoney(n / u.v, currency)}${u.s}`;
    }
  }

  return formatMoney(n, currency);
}

export function formatPercent(p: number | null, digits = 2): string {
  if (p === null || !Number.isFinite(p)) return '—';
  return `${(p * 100).toFixed(digits)}%`;
}

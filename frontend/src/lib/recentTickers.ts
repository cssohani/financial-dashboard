const KEY = 'fd:recentTickers:v1';
const MAX = 8;

export function getRecentTickers(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw).slice(0, MAX);
  } catch {
    return [];
  }
}

export function addRecentTicker(ticker: string) {
  const t = ticker.trim().toUpperCase();
  if (!/^[A-Z.\-]{1,10}$/.test(t)) return;

  const curr = getRecentTickers();
  const next = [t, ...curr.filter((x) => x !== t)].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
}

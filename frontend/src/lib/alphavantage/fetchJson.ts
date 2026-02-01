export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });

  if (!res.ok) {
    throw new Error(`Alpha Vantage HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

export const AV_BASE_URL = 'https://www.alphavantage.co/query';

export function getApiKey(): string {
  const key = process.env.ALPHAVANTAGE_API_KEY;
  if (!key) throw new Error('Missing ALPHAVANTAGE_API_KEY in env');
  return key;
}

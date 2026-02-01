import { AV_BASE_URL, getApiKey } from './config';

export function avUrl(functionName: string, symbol: string) {
  const key = getApiKey();
  const params = new URLSearchParams({
    function: functionName,
    symbol,
    apikey: key,
  });
  return `${AV_BASE_URL}?${params.toString()}`;
}

import TickerDashboardShell from './ui/TickerDashboardShell';

export default async function Page(props: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await props.params;
  return <TickerDashboardShell initialTicker={symbol} />;
}

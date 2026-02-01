import React from 'react';

export function StatRow(props: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <div className="text-sm text-zinc-400">{props.label}</div>
      <div className="text-sm tabular-nums text-zinc-100">{props.value}</div>
    </div>
  );
}

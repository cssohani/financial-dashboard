import React from 'react';

export function InfoCard(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 shadow-sm">
      <div className="mb-3 text-xs font-medium tracking-wide text-zinc-400">{props.title}</div>
      {props.children}
    </div>
  );
}

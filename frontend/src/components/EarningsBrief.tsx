'use client';

import { useState } from 'react';
import type { EarningsBrief } from '@/src/types/earnings';

export function EarningsBrief({ ticker }: { ticker: string }) {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [error, setError] = useState<string>('');
  const [data, setData] = useState<EarningsBrief | null>(null);

  async function generate() {
    setStatus('loading');
    setError('');
    setData(null);

    try {
      const res = await fetch('/api/earnings-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, text }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed (${res.status})`);
      }

      const json = (await res.json()) as EarningsBrief;
      setData(json);
      setStatus('success');
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
      setStatus('error');
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-zinc-100">AI Earnings Brief</div>
          <div className="text-xs text-zinc-500">
            Paste earnings press release text. Output is AI-generated and may be incorrect.
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100"
        >
          {open ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste earnings press release or shareholder letter excerpt here…"
            className="h-40 w-full rounded-xl border border-zinc-800 bg-black p-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={generate}
              disabled={status === 'loading' || text.trim().length < 200}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 disabled:opacity-50"
            >
              {status === 'loading' ? 'Generating…' : 'Generate'}
            </button>

            {status === 'success' && data && (
              <div className="text-xs text-zinc-500">
                Model: {data.meta.provider}:{data.meta.model}
              </div>
            )}
          </div>

          {status === 'error' && (
            <div className="rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {data && (
            <div className="space-y-4">
              {data.overview && (
                <section>
                  <div className="text-xs font-medium text-zinc-400">OVERVIEW</div>
                  <div className="mt-1 text-sm text-zinc-100">{data.overview.text}</div>
                  <div className="mt-1 text-xs text-zinc-500">“{data.overview.evidence}”</div>
                </section>
              )}

              <section>
                <div className="text-xs font-medium text-zinc-400">POSITIVES</div>
                <ul className="mt-2 space-y-2">
                  {data.positives.map((p, i) => (
                    <li key={i} className="text-sm text-zinc-100">
                      <span className="font-medium">{p.title}:</span> {p.text}
                      <div className="mt-1 text-xs text-zinc-500">“{p.evidence}”</div>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <div className="text-xs font-medium text-zinc-400">CONCERNS</div>
                <ul className="mt-2 space-y-2">
                  {data.concerns.map((c, i) => (
                    <li key={i} className="text-sm text-zinc-100">
                      <span className="font-medium">{c.title}:</span> {c.text}
                      <div className="mt-1 text-xs text-zinc-500">“{c.evidence}”</div>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <div className="text-xs font-medium text-zinc-400">GUIDANCE</div>
                <div className="mt-1 text-sm text-zinc-100">{data.guidance?.text ?? 'Not mentioned.'}</div>
                {data.guidance?.evidence && (
                  <div className="mt-1 text-xs text-zinc-500">“{data.guidance.evidence}”</div>
                )}
              </section>

              {data.notableNumbers.length > 0 && (
                <section>
                  <div className="text-xs font-medium text-zinc-400">NOTABLE NUMBERS</div>
                  <ul className="mt-2 space-y-2">
                    {data.notableNumbers.map((n, i) => (
                      <li key={i} className="text-sm text-zinc-100">
                        <span className="font-medium">{n.label}:</span> {n.value}
                        <div className="mt-1 text-xs text-zinc-500">“{n.evidence}”</div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

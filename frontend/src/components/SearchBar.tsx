'use client';

import React, { useEffect, useRef } from 'react';

export function SearchBar(props: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== ref.current) {
        e.preventDefault();
        ref.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === ref.current) {
        ref.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
      className="flex w-full items-center gap-2"
    >
      <div className="flex w-full items-center rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
        <span className="mr-2 text-xs text-zinc-500">Ticker</span>
        <input
          ref={ref}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder="AAPL"
          className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          spellCheck={false}
          autoCapitalize="characters"
        />
        <span className="ml-2 text-[11px] text-zinc-600">/</span>
      </div>

      <button
        type="submit"
        disabled={props.disabled}
        className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 disabled:opacity-50"
      >
        Search
      </button>
    </form>
  );
}

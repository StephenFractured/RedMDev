'use client';
import { useState } from 'react';

export default function CopyButton({ text, label = 'Copy', className = '' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }); }}
      className={`rounded border border-border bg-panel px-1.5 py-0.5 text-[11px] text-muted hover:text-fg ${className}`}
      title={`Copy ${text.length > 60 ? 'value' : text}`}
    >
      {done ? 'Copied' : label}
    </button>
  );
}

'use client';
import { useState } from 'react';
import CopyButton from './CopyButton';

/** Pre-highlighted snippets (html) with tabs and a copy button. */
export default function CodeTabs({ tabs }: { tabs: { label: string; code: string; html: string }[] }) {
  const [i, setI] = useState(0);
  const t = tabs[i];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-code">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        {tabs.map((x, j) => (
          <button key={x.label} onClick={() => setI(j)}
            className={`rounded px-2 py-1 text-xs ${j === i ? 'bg-panel-2 font-medium text-fg' : 'text-muted hover:text-fg'}`}>{x.label}</button>
        ))}
        <CopyButton text={t.code} className="ml-auto" />
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed"><code className="mono" dangerouslySetInnerHTML={{ __html: t.html }} /></pre>
    </div>
  );
}

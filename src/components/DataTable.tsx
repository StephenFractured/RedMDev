'use client';
import { useEffect, useRef, useState } from 'react';
import type { Entry } from '@/lib/db';
import { inlineMd, plain } from './InlineMd';

type Meta = { id: string; index: string; title: string; kind: 'table' | 'list'; columns: string[]; row_count: number; source_file: string };
type Page = { rows: Entry[]; total: number; page: number; pageSize: number };

function Cell({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const text = plain(value);
  if (!value.trim()) return <td className="px-3 py-1.5" />;
  return (
    <td className="group relative max-w-[28rem] px-3 py-1.5 pr-10 align-top">
      <span className="mono break-words text-[13px]">{inlineMd(value)}</span>
      {text && (
        <button onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1000); })}
          className="absolute right-1.5 top-1.5 rounded border border-border bg-panel px-1 text-[10px] text-muted opacity-0 group-hover:opacity-100 focus:opacity-100">
          {copied ? '✓' : 'copy'}
        </button>
      )}
    </td>
  );
}

export default function DataTable({ meta, initial, targetRow }: { meta: Meta; initial: Page; targetRow?: number }) {
  const [data, setData] = useState<Page>(initial);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(initial.page);
  const [open, setOpen] = useState<Set<number>>(new Set(targetRow !== undefined ? [targetRow] : []));
  const [loading, setLoading] = useState(false);
  const first = useRef(true);
  const target = useRef<HTMLTableRowElement>(null);

  useEffect(() => { target.current?.scrollIntoView({ block: 'center' }); }, []);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/entries?dataset=${encodeURIComponent(meta.id)}&q=${encodeURIComponent(q)}&page=${page}`, { signal: ctrl.signal })
        .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
    }, q ? 200 : 0);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, page, meta.id]);

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const cols = meta.columns.filter(c => meta.kind !== 'list' || c !== 'count');
  const grouped = meta.kind === 'list';

  return (
    <div id={`ds-${meta.index}`} className="scroll-mt-20 overflow-hidden rounded-lg border border-border bg-panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h3 className="mr-auto font-semibold">{meta.title}</h3>
        <span className="text-xs text-muted">{data.total.toLocaleString()} {q ? 'matches' : 'rows'} · {meta.source_file}</span>
        <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="Filter this table…"
          className="w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-accent sm:w-64" />
      </div>
      <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
        <table className="w-full text-left text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              {cols.map(c => <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{c}</th>)}
              {grouped && <th className="px-3 py-2 font-medium">entries</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.rows.map(r => {
              const isTarget = r.ord === targetRow;
              const expanded = open.has(r.ord) || (!!q && grouped);
              const items = r.items ?? [];
              const shown = q ? items.filter(i => i.toLowerCase().includes(q.toLowerCase())) : items;
              return (
                <tr key={r.id} ref={isTarget ? target : undefined} className={isTarget ? 'bg-gold/10' : 'hover:bg-panel-2/60'}>
                  {cols.map(c => <Cell key={c} value={r.cells[c] ?? ''} />)}
                  {grouped && (
                    <td className="px-3 py-1.5 align-top">
                      <button className="text-xs text-accent" onClick={() => setOpen(s => { const n = new Set(s); if (n.has(r.ord)) n.delete(r.ord); else n.add(r.ord); return n; })}>
                        {expanded ? 'Hide' : `Show ${items.length}`}
                      </button>
                      {expanded && (
                        <ul className="mono mt-1 max-h-72 overflow-y-auto text-[12px] leading-5">
                          {shown.map((i, j) => <li key={j} className="cursor-copy hover:text-accent" title="Click to copy" onClick={() => navigator.clipboard.writeText(i)}>{i}</li>)}
                        </ul>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {data.rows.length === 0 && <tr><td colSpan={cols.length + 1} className="px-3 py-6 text-center text-muted">No rows match.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">← Prev</button>
          <span className="text-muted">Page {page + 1} of {pages.toLocaleString()}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}

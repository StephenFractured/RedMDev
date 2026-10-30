'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import type { SearchResult, SearchHit } from '@/lib/search';
import { nativeHref, categoryHref, entryHref } from '@/lib/links';

type Item = { href: string; title: string; sub: string; group: string; mono?: boolean };

function toItems(r: SearchResult | null): Item[] {
  if (!r) return [];
  const items: Item[] = [];
  for (const h of r.natives as Extract<SearchHit, { type: 'native' }>[])
    items.push({ group: 'Natives', href: nativeHref(h.hash), title: h.name, sub: `${h.namespace} · ${h.hash}`, mono: true });
  for (const h of r.categories as Extract<SearchHit, { type: 'category' }>[])
    items.push({ group: 'Categories', href: categoryHref(h.path), title: h.title, sub: h.path });
  for (const h of r.entries as Extract<SearchHit, { type: 'entry' }>[])
    items.push({ group: 'Discoveries', href: entryHref(h.dataset_id, h.ord), title: h.label, sub: `${h.category_title} › ${h.dataset_title}${h.detail ? ' — ' + h.detail : ''}`, mono: true });
  if (r.q) items.push({ group: 'More', href: `/search?q=${encodeURIComponent(r.q)}`, title: `See all results for “${r.q}”`, sub: r.joaat ? `joaat("${r.q}") = ${r.joaat}` : '' });
  return items;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<SearchResult | null>(null);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const items = useMemo(() => toItems(res), [res]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea, [contenteditable]');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 0); }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal }).then(r => r.json()).then(r => { setRes(r); setSel(0); }).catch(() => {});
    }, 120);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const go = (it: Item) => { setOpen(false); setQ(''); router.push(it.href); };

  return (
    <>
      <button onClick={() => setOpen(true)}
        aria-label="Search" className="flex items-center gap-2 rounded-md border border-border bg-panel px-2.5 py-2 text-sm text-muted hover:text-fg sm:w-64 sm:py-1.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <span className="hidden flex-1 text-left sm:inline">Search…</span>
        <kbd className="hidden rounded border border-border px-1 text-[10px] sm:inline">Ctrl K</kbd>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 bg-black/40 p-4 pt-[10vh]" onMouseDown={() => setOpen(false)}>
          <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-border bg-panel shadow-2xl" onMouseDown={e => e.stopPropagation()}>
            <input ref={input} value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, items.length - 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
                if (e.key === 'Enter') {
                  if (items[sel]) go(items[sel]);
                  else if (q.trim()) { setOpen(false); router.push(`/search?q=${encodeURIComponent(q.trim())}`); }
                }
              }}
              placeholder="Native name, hash (0x… / signed / unsigned), flag, anim, model…"
              className="w-full border-b border-border bg-transparent px-4 py-3.5 text-base outline-none" />
            <div className="max-h-[60vh] overflow-y-auto py-1">
              {q.trim().length < 2 && <p className="px-4 py-6 text-sm text-muted">Type at least 2 characters. Try <span className="mono">SetPedConfigFlag</span>, <span className="mono">0x1913FE4CBF41C463</span>, <span className="mono">blip_ambient_horse</span> or <span className="mono">-861219276</span>.</p>}
              {res && items.length <= 1 && <p className="px-4 py-6 text-sm text-muted">No matches. {res.joaat && <>joaat(&quot;{res.q}&quot;) = <span className="mono">{res.joaat}</span></>}</p>}
              {items.map((it, i) => (
                <div key={it.href + i}>
                  {(i === 0 || items[i - 1].group !== it.group) && <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{it.group}</div>}
                  <button onMouseEnter={() => setSel(i)} onClick={() => go(it)}
                    className={`block w-full px-4 py-2 text-left ${i === sel ? 'bg-panel-2' : ''}`}>
                    <div className={`truncate text-sm ${it.mono ? 'mono' : ''}`}>{it.title}</div>
                    {it.sub && <div className="truncate text-xs text-muted">{it.sub}</div>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

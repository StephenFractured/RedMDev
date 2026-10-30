import Link from 'next/link';
import type { Metadata } from 'next';
import { search, type SearchHit } from '@/lib/search';
import { nativeHref, categoryHref, entryHref } from '@/lib/links';

export const metadata: Metadata = { title: 'Search' };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim();
  const r = await search(q, { natives: 30, entries: 60 });
  const natives = r.natives as Extract<SearchHit, { type: 'native' }>[];
  const cats = r.categories as Extract<SearchHit, { type: 'category' }>[];
  const entries = r.entries as Extract<SearchHit, { type: 'entry' }>[];
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <form className="flex gap-2">
        <input name="q" defaultValue={q} autoFocus className="min-w-0 flex-1 rounded-lg border border-border bg-panel px-4 py-2.5 outline-none focus:border-accent" />
        <button className="rounded-lg bg-accent px-4 font-medium text-accent-fg">Search</button>
      </form>
      {r.joaat && <p className="text-sm text-muted">joaat(&quot;{q}&quot;) = <span className="mono text-fg">{r.joaat}</span> · <Link className="underline" href={`/tools/hash?s=${encodeURIComponent(q)}`}>more forms</Link></p>}
      {q.length >= 2 && !natives.length && !cats.length && !entries.length && <p className="text-muted">Nothing found for “{q}”.</p>}
      {cats.length > 0 && (
        <section><h2 className="mb-2 font-semibold">Categories</h2>
          <div className="flex flex-wrap gap-2">{cats.map(c => <Link key={c.path} href={categoryHref(c.path)} className="rounded-md border border-border bg-panel px-3 py-1.5 text-sm hover:border-accent">{c.title} <span className="text-muted">· {c.path}</span></Link>)}</div>
        </section>
      )}
      {natives.length > 0 && (
        <section><h2 className="mb-2 font-semibold">Natives</h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-panel">
            {natives.map(n => <li key={n.hash}><Link href={nativeHref(n.hash)} className="flex flex-wrap items-baseline gap-3 px-4 py-2 hover:bg-panel-2"><span className="mono text-sm font-medium">{n.name}</span><span className="mono text-xs text-muted">{n.hash}</span><span className="text-xs text-muted">{n.namespace}</span></Link></li>)}
          </ul>
        </section>
      )}
      {entries.length > 0 && (
        <section><h2 className="mb-2 font-semibold">Discoveries</h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-panel">
            {entries.map(e => (
              <li key={e.dataset_id + e.ord}><Link href={entryHref(e.dataset_id, e.ord)} className="block px-4 py-2 hover:bg-panel-2">
                <div className="mono text-sm">{e.label}</div>
                <div className="truncate text-xs text-muted">{e.category_title} › {e.dataset_title}{e.detail ? ` — ${e.detail}` : ''}</div>
              </Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

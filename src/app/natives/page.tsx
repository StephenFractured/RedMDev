import Link from 'next/link';
import type { Metadata } from 'next';
import { sql, likeEscape, type NativeRow } from '@/lib/db';
import { normNativeHash } from '@/lib/hash';
import { nativeHref } from '@/lib/links';
import { postCounts } from '@/lib/posts';

export const metadata: Metadata = { title: 'Natives' };
const PER_PAGE = 50;

type SP = { q?: string; ns?: string; page?: string; named?: string; docs?: string };

function href(sp: SP, patch: Partial<SP>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, String(v));
  const s = p.toString();
  return `/natives${s ? '?' + s : ''}`;
}

export default async function NativesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const page = Math.max(1, Number(sp.page) || 1);
  const pat = q ? '%' + likeEscape(/^0x[0-9a-f]{9,16}$/i.test(q) ? normNativeHash(q).toLowerCase() : q) + '%' : null;
  const where = sql`where true
    ${sp.ns ? sql`and namespace = ${sp.ns}` : sql``}
    ${pat ? sql`and search_text like ${pat}` : sql``}
    ${sp.named === '1' ? sql`and is_named` : sp.named === '0' ? sql`and not is_named` : sql``}
    ${sp.docs === '1' ? sql`and comment <> ''` : sql``}`;

  const [namespaces, rows, [{ total }]] = await Promise.all([
    sql<{ namespace: string; n: number }[]>`select namespace, count(*)::int n from natives group by 1 order by 1`,
    sql<NativeRow[]>`select hash, name, namespace, params, return_type, left(comment, 160) comment, is_named from natives ${where}
      order by ${q ? sql`(lower(name) like ${likeEscape(q) + '%'}) desc, ` : sql``} namespace, is_named desc, name
      limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}`,
    sql<{ total: number }[]>`select count(*)::int total from natives ${where}`,
  ]);
  const counts = await postCounts('native', rows.map(r => r.hash));
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Namespaces</h2>
        <div className="flex flex-wrap gap-1 lg:block">
          <Link href={href(sp, { ns: undefined, page: undefined })}
            className={`block rounded px-2 py-1 text-sm ${!sp.ns ? 'bg-panel-2 font-medium' : 'text-muted hover:text-fg'}`}>All</Link>
          {namespaces.map(n => (
            <Link key={n.namespace} href={href(sp, { ns: n.namespace, page: undefined })}
              className={`flex justify-between gap-2 rounded px-2 py-1 text-sm ${sp.ns === n.namespace ? 'bg-panel-2 font-medium' : 'text-muted hover:text-fg'}`}>
              <span className="mono text-[13px]">{n.namespace}</span><span className="text-xs tabular-nums opacity-70">{n.n}</span>
            </Link>
          ))}
        </div>
      </aside>
      <section className="min-w-0">
        <form className="mb-4 flex flex-wrap gap-2" action="/natives">
          {sp.ns && <input type="hidden" name="ns" value={sp.ns} />}
          <input name="q" defaultValue={sp.q} autoFocus placeholder="Filter by name, hash, parameter or description…"
            className="min-w-0 flex-1 rounded-md border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent" />
          <select name="named" defaultValue={sp.named ?? ''} className="rounded-md border border-border bg-panel px-2 text-sm">
            <option value="">Named + unnamed</option><option value="1">Named only</option><option value="0">Unnamed only</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-muted"><input type="checkbox" name="docs" value="1" defaultChecked={sp.docs === '1'} /> Has description</label>
          <button className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg">Filter</button>
        </form>
        <p className="mb-3 text-sm text-muted">{total.toLocaleString()} natives{sp.ns ? ` in ${sp.ns}` : ''}{q ? ` matching “${sp.q}”` : ''}</p>
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-panel">
          {rows.map(n => (
            <li key={n.hash}>
              <Link href={nativeHref(n.hash)} className="block px-4 py-2.5 hover:bg-panel-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className={`mono break-all text-sm font-medium ${n.is_named ? '' : 'text-muted'}`}>{n.name}</span>
                  <span className="mono text-xs text-muted">{n.hash}</span>
                  {!sp.ns && <span className="rounded bg-panel-2 px-1.5 text-[11px] text-muted">{n.namespace}</span>}
                  {counts.get(n.hash) ? <span className="text-[11px] text-gold">{counts.get(n.hash)} posts</span> : null}
                </div>
                <div className="mono mt-0.5 truncate text-xs text-muted">
                  {n.return_type} ({n.params.map(p => `${p.type} ${p.name}`).join(', ')})
                </div>
                {n.comment && <div className="mt-0.5 line-clamp-1 text-xs text-muted">{n.comment}</div>}
              </Link>
            </li>
          ))}
          {rows.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">No natives match.</li>}
        </ul>
        {pages > 1 && (
          <nav className="mt-4 flex items-center justify-between text-sm">
            {page > 1 ? <Link className="rounded-md border border-border px-3 py-1.5" href={href(sp, { page: String(page - 1) })}>← Previous</Link> : <span />}
            <span className="text-muted">Page {page} of {pages}</span>
            {page < pages ? <Link className="rounded-md border border-border px-3 py-1.5" href={href(sp, { page: String(page + 1) })}>Next →</Link> : <span />}
          </nav>
        )}
      </section>
    </div>
  );
}

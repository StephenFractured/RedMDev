import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { sql, type NativeRow } from '@/lib/db';
import { normNativeHash } from '@/lib/hash';
import { snippets, pascalName } from '@/lib/natives';
import { highlight, renderMarkdown } from '@/lib/markdown';
import { categoryHref, nativeHref } from '@/lib/links';
import CodeTabs from '@/components/CodeTabs';
import CopyButton from '@/components/CopyButton';
import Discussion from '@/components/Discussion';

async function load(param: string) {
  if (!/^0x[0-9a-f]{1,16}$/i.test(param)) return null;
  const [n] = await sql<NativeRow[]>`select * from natives where hash = ${normNativeHash(param)}`;
  return n ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ hash: string }> }): Promise<Metadata> {
  const n = await load((await params).hash);
  return n ? { title: n.name, description: n.comment.slice(0, 160) || `${n.namespace} native ${n.hash}` } : {};
}

export default async function NativePage({ params }: { params: Promise<{ hash: string }> }) {
  const n = await load((await params).hash);
  if (!n) notFound();
  const [refs, neighbours] = await Promise.all([
    sql<{ path: string; title: string; parent_title: string | null }[]>`
      select c.path, c.title, p.title parent_title from native_refs r join categories c on c.path = r.category_path
      left join categories p on p.path = c.parent_path where r.native_hash = ${n.hash} order by c.path`,
    sql<{ hash: string; name: string }[]>`
      select hash, name from natives where namespace = ${n.namespace} and is_named order by name`,
  ]);
  const idx = neighbours.findIndex(x => x.hash === n.hash);
  const prev = idx > 0 ? neighbours[idx - 1] : null;
  const next = idx >= 0 && idx < neighbours.length - 1 ? neighbours[idx + 1] : null;
  const tabs = snippets(n).map(s => ({ ...s, html: highlight(s.code, s.lang) }));
  const path = nativeHref(n.hash);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <nav className="mb-3 text-sm text-muted">
          <Link href="/natives" className="hover:text-fg">Natives</Link> ›{' '}
          <Link href={`/natives?ns=${n.namespace}`} className="hover:text-fg">{n.namespace}</Link>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mono break-all text-2xl font-semibold">{n.name}</h1>
          <CopyButton text={n.name} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1.5"><span className="mono">{n.hash}</span><CopyButton text={n.hash} /></span>
          <span className="flex items-center gap-1.5">Lua/JS: <span className="mono">{pascalName(n)}</span><CopyButton text={pascalName(n)} /></span>
          {n.build && <span>Build {n.build}</span>}
          {n.apiset && <span className="rounded bg-panel-2 px-1.5 text-xs">{n.apiset}</span>}
        </div>
      </div>

      <section className="rounded-lg border border-border bg-panel p-4">
        <div className="mono text-sm leading-7">
          <span className="text-gold">{n.return_type}</span> <span className="font-semibold">{n.name}</span>(
          {n.params.length === 0 ? ')' : (
            <>
              {n.params.map((p, i) => (
                <div key={i} className="pl-6"><span className="text-gold">{p.type}</span> {p.name}{i < n.params.length - 1 ? ',' : ''}</div>
              ))}
              )
            </>
          )}
        </div>
      </section>

      {n.comment && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Description</h2>
          <div className="prose text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(n.comment.replace(/\n/g, '  \n')).replace(/https:\/\/github\.com\/femga\/rdr3_discoveries\/(?:tree|blob)\/master\/([^"<\s]*?)(?:\/README\.md)?(?=["<\s])/gi, (_, p: string) => categoryHref(p.replace(/\/$/, ''))) }} />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Usage</h2>
        <CodeTabs tabs={tabs} />
        <p className="mt-2 text-xs text-muted">Generated from the signature. Parameter names are placeholders; check the description and examples for real values.</p>
      </section>

      {n.examples.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Documented examples</h2>
          <div className="space-y-3">
            {n.examples.map((e, i) => (
              <CodeTabs key={i} tabs={[{ label: e.lang.toUpperCase(), code: e.code, html: highlight(e.code, e.lang === 'js' ? 'javascript' : e.lang) }]} />
            ))}
          </div>
        </section>
      )}

      {refs.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Used in discoveries</h2>
          <div className="flex flex-wrap gap-2">
            {refs.map(r => (
              <Link key={r.path} href={categoryHref(r.path)} className="rounded-md border border-border bg-panel px-3 py-1.5 text-sm hover:border-accent">
                {r.parent_title && <span className="text-muted">{r.parent_title} › </span>}{r.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      <Discussion type="native" id={n.hash} path={path} />

      <nav className="flex justify-between gap-4 border-t border-border pt-4 text-sm">
        {prev ? <Link className="mono min-w-0 break-all text-muted hover:text-fg" href={nativeHref(prev.hash)}>← {prev.name}</Link> : <span />}
        {next ? <Link className="mono min-w-0 break-all text-right text-muted hover:text-fg" href={nativeHref(next.hash)}>{next.name} →</Link> : <span />}
      </nav>
    </div>
  );
}

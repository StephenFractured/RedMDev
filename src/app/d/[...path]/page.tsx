import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { loadCategory, entriesPage, categoryTree, PAGE_SIZE } from '@/lib/discoveries';
import { renderMarkdown, highlight } from '@/lib/markdown';
import { categoryHref, nativeHref, datasetIndex } from '@/lib/links';
import DataTable from '@/components/DataTable';
import Discussion from '@/components/Discussion';
import CopyButton from '@/components/CopyButton';
import type { Dataset } from '@/lib/db';

const decode = (segs: string[]) => segs.map(decodeURIComponent).join('/');

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
  const d = await loadCategory(decode((await params).path));
  return d ? { title: d.cat.title, description: `${d.cat.title} from rdr3_discoveries: ${d.datasets.map(x => x.title).join(', ')}`.slice(0, 160) } : {};
}

export default async function CategoryPage({ params, searchParams }: {
  params: Promise<{ path: string[] }>; searchParams: Promise<{ ds?: string; row?: string }>;
}) {
  const path = decode((await params).path);
  const sp = await searchParams;
  const data = await loadCategory(path);
  if (!data) notFound();
  const { cat, datasets, children, refs } = data;
  const tree = await categoryTree();
  const crumbs = path.split('/').map((_, i, a) => a.slice(0, i + 1).join('/'));
  const rootPath = crumbs[0];

  const targetRow = sp.row !== undefined ? Number(sp.row) : undefined;
  const block = async (d: Dataset) => {
    if (d.kind === 'code') {
      const lang = d.source_file.endsWith('.lua') || !d.source_file.includes('.') ? 'lua' : 'plaintext';
      return (
        <details key={d.id} id={`ds-${datasetIndex(d.id)}`} open={datasets.length <= 3} className="overflow-hidden rounded-lg border border-border bg-panel">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 font-semibold">
            {d.title} <span className="text-xs font-normal text-muted">{d.source_file}</span>
            <CopyButton text={d.code ?? ''} className="ml-auto" />
          </summary>
          <pre className="max-h-[70vh] overflow-auto border-t border-border bg-code p-3 text-[12.5px] leading-relaxed"><code className="mono" dangerouslySetInnerHTML={{ __html: highlight(d.code ?? '', lang) }} /></pre>
        </details>
      );
    }
    const isTarget = sp.ds === datasetIndex(d.id) && targetRow !== undefined;
    const page = isTarget ? Math.floor(targetRow! / PAGE_SIZE) : 0;
    const rows = await entriesPage(d.id, page);
    return (
      <div key={d.id} className="space-y-2">
        {d.notes_md && <div className="prose text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(d.notes_md) }} />}
        <DataTable
          meta={{ id: d.id, index: datasetIndex(d.id), title: d.title, kind: d.kind as 'table' | 'list', columns: d.columns, row_count: d.row_count, source_file: d.source_file }}
          initial={{ rows, total: d.row_count, page, pageSize: PAGE_SIZE }}
          targetRow={isTarget ? targetRow : undefined} />
      </div>
    );
  };

  // README prose with its tables swapped back in at the spots they came from.
  const parts = cat.intro_md.split(/<!--dataset:([^>]+)-->/);
  const placed = new Set<string>();
  const body: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i].trim()) body.push(<div key={`md${i}`} className="prose text-[15px]" dangerouslySetInnerHTML={{ __html: renderMarkdown(parts[i]) }} />);
    } else {
      const d = datasets.find(x => x.id === parts[i]);
      if (d) { placed.add(d.id); body.push(await block(d)); }
    }
  }
  for (const d of datasets) if (!placed.has(d.id)) body.push(await block(d));

  const section = tree.filter(c => c.path === rootPath || c.path.startsWith(rootPath + '/'));
  const depth = (p: string) => p.split('/').length - 1;

  return (
    <div className="grid gap-8 lg:grid-cols-[230px_1fr]">
      <aside className="text-sm lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <Link href="/d" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted hover:text-fg">All discoveries</Link>
        <ul>
          {section.map(c => (
            <li key={c.path}>
              <Link href={categoryHref(c.path)} style={{ paddingLeft: `${0.5 + depth(c.path) * 0.75}rem` }}
                className={`block truncate rounded py-1 pr-2 ${c.path === path ? 'bg-panel-2 font-medium text-fg' : 'text-muted hover:text-fg'}`}>{c.title}</Link>
            </li>
          ))}
        </ul>
      </aside>
      <div className="min-w-0 space-y-6">
        <div>
          <nav className="mb-2 flex flex-wrap gap-1 text-sm text-muted">
            <Link href="/d" className="hover:text-fg">Discoveries</Link>
            {crumbs.slice(0, -1).map(c => <span key={c}>› <Link href={categoryHref(c)} className="hover:text-fg">{tree.find(t => t.path === c)?.title ?? c}</Link></span>)}
          </nav>
          <h1 className="text-2xl font-semibold">{cat.title}</h1>
          <p className="mt-1 text-xs text-muted">
            Source: <a className="underline" href={`https://github.com/femga/rdr3_discoveries/tree/master/${path}`} target="_blank" rel="noopener">rdr3_discoveries/{path}</a>
          </p>
        </div>

        {children.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {children.map(c => (
              <Link key={c.path} href={categoryHref(c.path)} className="flex items-baseline justify-between rounded-md border border-border bg-panel px-3 py-2 hover:border-accent">
                <span className="font-medium">{c.title}</span><span className="text-xs text-muted">{c.rows.toLocaleString()} rows</span>
              </Link>
            ))}
          </div>
        )}

        {body}

        {refs.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Natives used on this page</h2>
            <div className="flex flex-wrap gap-1.5">
              {refs.map(r => <Link key={r.hash} href={nativeHref(r.hash)} className="mono rounded border border-border bg-panel px-2 py-1 text-xs hover:border-accent">{r.name}</Link>)}
            </div>
          </section>
        )}

        <Discussion type="category" id={cat.path} path={categoryHref(cat.path)} />
      </div>
    </div>
  );
}

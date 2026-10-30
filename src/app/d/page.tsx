import Link from 'next/link';
import type { Metadata } from 'next';
import { categoryTree } from '@/lib/discoveries';
import { categoryHref } from '@/lib/links';

export const metadata: Metadata = { title: 'Discoveries' };

export default async function DiscoveriesIndex() {
  const all = await categoryTree();
  const top = all.filter(c => !c.parent_path);
  const under = (p: string) => all.filter(c => c.path.startsWith(p + '/'));
  return (
    <div>
      <h1 className="text-2xl font-semibold">Discoveries</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Everything from rdr3_discoveries: flags, anims, models, audio, textures, zones and more. Each folder is a page with its
        examples and searchable tables. Press <kbd className="rounded border border-border px-1 text-xs">Ctrl K</kbd> to search all of it at once.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {top.map(c => {
          const kids = all.filter(k => k.parent_path === c.path);
          const rows = c.rows + under(c.path).reduce((s, k) => s + k.rows, 0);
          return (
            <div key={c.path} className="rounded-lg border border-border bg-panel p-4">
              <Link href={categoryHref(c.path)} className="flex items-baseline justify-between gap-2 hover:text-accent">
                <h2 className="font-semibold">{c.title}</h2>
                <span className="text-xs text-muted">{rows.toLocaleString()} rows</span>
              </Link>
              {kids.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {kids.slice(0, 18).map(k => (
                    <li key={k.path}><Link href={categoryHref(k.path)} className="block rounded bg-panel-2 px-2 py-0.5 text-xs text-muted hover:text-fg">{k.title}</Link></li>
                  ))}
                  {kids.length > 18 && <li className="px-1 text-xs text-muted">+{kids.length - 18} more</li>}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

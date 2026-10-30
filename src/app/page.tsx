import Link from 'next/link';
import { sql } from '@/lib/db';
import { recentPosts } from '@/lib/posts';
import { categoryTree } from '@/lib/discoveries';
import { categoryHref, nativeHref } from '@/lib/links';

export const revalidate = 60;

export default async function Home() {
  const [[stats], tree, recent] = await Promise.all([
    sql<{ natives: number; named: number; rows: number; posts: number }[]>`
      select (select count(*) from natives)::int natives, (select count(*) from natives where is_named)::int named,
             (select coalesce(sum(row_count),0) from datasets)::int rows, (select count(*) from posts where not hidden)::int posts`,
    categoryTree(),
    recentPosts(8),
  ]);
  const top = tree.filter(c => !c.parent_path);
  const popular = ['AI/CPED_CONFIG_FLAGS', 'animations/ingameanims', 'useful_info_from_rpfs/textures/blips', 'clothes', 'peds', 'doorHashes', 'weapons', 'Controls']
    .map(p => tree.find(t => t.path === p)).filter(Boolean) as typeof tree;

  return (
    <div className="space-y-10">
      <section className="pt-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">RedM natives and discoveries, in one place</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted">
          Look up any RDR3 native, every flag, anim, model and texture from rdr3_discoveries, and the examples other developers have shared.
        </p>
        <form action="/search" className="mx-auto mt-6 flex max-w-2xl gap-2">
          <input name="q" autoFocus placeholder="Search natives, hashes, flags, anims, models…"
            className="min-w-0 flex-1 rounded-lg border border-border bg-panel px-4 py-3 outline-none focus:border-accent" />
          <button className="rounded-lg bg-accent px-5 font-medium text-accent-fg">Search</button>
        </form>
        <p className="mt-3 text-sm text-muted">
          {stats.natives.toLocaleString()} natives ({stats.named.toLocaleString()} named) · {stats.rows.toLocaleString()} discovery rows · {stats.posts.toLocaleString()} community posts
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Jump to</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/natives" className="rounded-lg border border-border bg-panel p-3 hover:border-accent">
            <div className="font-medium">All natives</div><div className="text-xs text-muted">Browse by namespace</div>
          </Link>
          {popular.map(c => (
            <Link key={c.path} href={categoryHref(c.path)} className="rounded-lg border border-border bg-panel p-3 hover:border-accent">
              <div className="font-medium">{c.title}</div><div className="truncate text-xs text-muted">{c.path}</div>
            </Link>
          ))}
          <Link href="/tools/hash" className="rounded-lg border border-border bg-panel p-3 hover:border-accent">
            <div className="font-medium">Hash tool</div><div className="text-xs text-muted">joaat, hex, signed, unsigned</div>
          </Link>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Discoveries</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {top.map(c => (
              <Link key={c.path} href={categoryHref(c.path)} className="flex items-baseline justify-between rounded-md border border-border bg-panel px-3 py-2 hover:border-accent">
                <span>{c.title}</span>
                <span className="text-xs text-muted">{tree.filter(t => t.path.startsWith(c.path + '/')).length || ''}</span>
              </Link>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Latest from the community</h2>
          {recent.length === 0 && <p className="text-sm text-muted">No posts yet. Open any native or discovery page and add the first example.</p>}
          <ul className="space-y-2">
            {recent.map(p => (
              <li key={p.id}>
                <Link href={(p.target_type === 'native' ? nativeHref(p.target_id) : categoryHref(p.target_id)) + `#post-${p.id}`}
                  className="block rounded-md border border-border bg-panel px-3 py-2 hover:border-accent">
                  <div className="text-xs text-muted">{p.username} · {p.kind === 'example' ? 'example on' : 'comment on'} <span className="mono">{p.target_label}</span></div>
                  <div className="line-clamp-2 text-sm">{p.title || p.body_md.replace(/```\w*/g, '')}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

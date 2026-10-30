import 'server-only';
import { sql, likeEscape } from './db';
import { joaat, toHex, parseHash32, normNativeHash } from './hash';

export type SearchHit =
  | { type: 'native'; hash: string; name: string; namespace: string; return_type: string }
  | { type: 'entry'; dataset_id: string; dataset_title: string; category_path: string; category_title: string; ord: number; label: string; detail: string }
  | { type: 'category'; path: string; title: string };

export type SearchResult = { q: string; joaat: string | null; natives: SearchHit[]; categories: SearchHit[]; entries: SearchHit[] };

export async function search(qRaw: string, opts: { natives?: number; entries?: number } = {}): Promise<SearchResult> {
  const q = qRaw.trim().slice(0, 100);
  if (q.length < 2) return { q, joaat: null, natives: [], categories: [], entries: [] };
  const lower = q.toLowerCase();
  const pat = '%' + likeEscape(lower) + '%';
  const isNativeHash = /^0x[0-9a-f]{9,16}$/i.test(q);
  const nativePat = isNativeHash ? '%' + likeEscape(normNativeHash(q).toLowerCase()) + '%' : pat;
  // A 32-bit hash typed in any form also matches its other forms (indexed into search_text).
  const h32 = parseHash32(q);
  const entryPat = h32 !== null && !isNativeHash ? '%' + toHex(h32).toLowerCase() + '%' : pat;

  const [natives, categories, entries] = await Promise.all([
    sql<{ hash: string; name: string; namespace: string; return_type: string }[]>`
      select hash, name, namespace, return_type from natives
      where search_text like ${nativePat}
      order by (lower(name) = ${lower} or lower(name) = ${lower.replace(/ /g, '_')}) desc,
               (lower(name) like ${likeEscape(lower) + '%'}) desc, is_named desc, length(name)
      limit ${opts.natives ?? 8}`,
    sql<{ path: string; title: string }[]>`
      select path, title from categories where lower(title) like ${pat} or lower(path) like ${pat}
      order by length(path) limit 6`,
    sql<{ dataset_id: string; dataset_title: string; category_path: string; category_title: string; ord: number; cells: Record<string, string>; items: string[] | null }[]>`
      select e.dataset_id, d.title dataset_title, d.category_path, c.title category_title, e.ord, e.cells,
             case when e.items is not null then (select coalesce(jsonb_agg(i), '[]') from jsonb_array_elements_text(e.items) i where lower(i) like ${pat} limit 5) end items
      from entries e join datasets d on d.id = e.dataset_id join categories c on c.path = d.category_path
      where e.search_text like ${entryPat}
      order by length(e.search_text) limit ${opts.entries ?? 12}`,
  ]);

  return {
    q,
    joaat: /^[\w@.\-/]+$/.test(q) && h32 === null ? toHex(joaat(q)) : null,
    natives: natives.map(n => ({ type: 'native', ...n })),
    categories: categories.map(c => ({ type: 'category', ...c })),
    entries: entries.map(e => {
      const vals = Object.entries(e.cells).filter(([k]) => k !== 'note' && k !== 'count');
      const strip = (s: string) => s.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
      const isNum = (v: string) => /^-?(0x)?[\da-f.]+$/i.test(v);
      const named = vals.find(([, v]) => strip(v) && !isNum(strip(v)));
      const label = strip(named?.[1] ?? vals[0]?.[1] ?? '');
      const hit = vals.find(([, v]) => strip(v) !== label && strip(v).toLowerCase().includes(lower));
      const rest = vals.filter(([, v]) => strip(v) && strip(v) !== label && v !== hit?.[1]).slice(0, 3);
      const detail = e.items?.length ? e.items.join(', ')
        : [...(hit ? [hit] : []), ...rest].map(([k, v]) => `${k}: ${strip(v)}`).join(' · ');
      return { type: 'entry', dataset_id: e.dataset_id, dataset_title: e.dataset_title, category_path: e.category_path,
        category_title: e.category_title, ord: e.ord, label, detail: detail.slice(0, 160) };
    }),
  };
}

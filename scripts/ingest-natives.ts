// Imports RDR3 natives. Primary source: VORPCORE/RDR3natives (alloc8or's DB plus community
// descriptions and examples). alloc8or's DB fills any gaps. Run: npm run ingest:natives
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { sql } from './lib/db';
import { normNativeHash } from '../src/lib/hash';

const SOURCES = {
  vorp: 'https://raw.githubusercontent.com/VORPCORE/RDR3natives/main/rdr3natives.json',
  alloc8or: 'https://raw.githubusercontent.com/alloc8or/rdr3-nativedb-data/master/natives.json',
};

type Native = {
  name: string; comment?: string; params: { type: string; name: string }[];
  return_type: string; build?: string; examples?: { lang: string; code: string }[]; apiset?: string;
};
type Db = Record<string, Record<string, Native>>;

async function load(key: keyof typeof SOURCES): Promise<Db> {
  const cache = `.data/${key}.json`;
  if (!process.argv.includes('--refresh') && existsSync(cache)) return JSON.parse(await readFile(cache, 'utf8'));
  const res = await fetch(SOURCES[key]);
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`);
  const text = await res.text();
  await mkdir('.data', { recursive: true });
  await writeFile(cache, text);
  return JSON.parse(text);
}

async function main() {
  const [vorp, alloc] = await Promise.all([load('vorp'), load('alloc8or')]);
  const fallback = new Map<string, Native>();
  for (const ns of Object.values(alloc)) for (const [h, n] of Object.entries(ns)) fallback.set(normNativeHash(h), n);

  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const add = (namespace: string, rawHash: string, n: Native, alt?: Native) => {
    const hash = normNativeHash(rawHash);
    if (seen.has(hash)) return;
    seen.add(hash);
    const name = n.name || alt?.name || `_${hash}`;
    const comment = (n.comment || alt?.comment || '').trim();
    const params = n.params ?? alt?.params ?? [];
    rows.push({
      hash, name, namespace, params: sql.json(params), return_type: n.return_type || 'void',
      comment, build: n.build ?? null, examples: sql.json(n.examples ?? []), apiset: n.apiset ?? '',
      search_text: [name, hash, namespace, params.map(p => p.name).join(' '), comment.slice(0, 500)].join(' ').toLowerCase(),
    });
  };
  for (const [ns, list] of Object.entries(vorp)) for (const [h, n] of Object.entries(list)) add(ns, h, n, fallback.get(normNativeHash(h)));
  for (const [ns, list] of Object.entries(alloc)) for (const [h, n] of Object.entries(list)) add(ns, h, n);

  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    await sql`
      insert into natives ${sql(chunk, 'hash', 'name', 'namespace', 'params', 'return_type', 'comment', 'build', 'examples', 'apiset', 'search_text')}
      on conflict (hash) do update set
        name = excluded.name, namespace = excluded.namespace, params = excluded.params,
        return_type = excluded.return_type, comment = excluded.comment, build = excluded.build,
        examples = excluded.examples, apiset = excluded.apiset, search_text = excluded.search_text, updated_at = now()`;
  }
  console.log(`natives: ${rows.length} upserted`);
  await sql.end();
}
main().catch(e => { console.error(e); process.exit(1); });

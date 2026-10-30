// Imports a checkout of femga/rdr3_discoveries into categories / datasets / entries.
// Usage: npm run ingest:discoveries -- <path-to-rdr3_discoveries>
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { marked, type Tokens } from 'marked';
import { sql } from './lib/db';
import { parseLuaTables } from './lib/lua';
import { shapeFields, tupleColumnsFromComment, type ShapeHints, type Row } from './lib/shape';
import { parseHash32, hashForms, normNativeHash } from '../src/lib/hash';

const ROOT = path.resolve(process.argv[2] ?? process.env.DISCOVERIES_DIR ?? '../rdr3_discoveries');

// Column names for files whose layout isn't self-describing. Keyed by file basename.
const HINTS: Record<string, ShapeHints> = {
  'doorhashes.lua': { keyColumn: 'door_hash', tupleColumns: ['door_hash', 'model_hash', 'model', 'x', 'y', 'z'] },
  'ingameanims_list.lua': { keyColumn: 'dictionary', list: true },
  'megadictanims.lua': { keyColumn: 'dictionary', list: true },
  'audio_banks.lua': { keyColumn: 'bank', list: true },
  'soundsets.lua': { keyColumn: 'soundset', list: true },
  'frontend_soundsets.lua': { keyColumn: 'soundset', list: true },
  'ptfx_assets_looped.lua': { keyColumn: 'asset', list: true },
  'ptfx_assets_non_looped.lua': { keyColumn: 'asset', list: true },
  'scenario_types_with_conditional_anims.lua': { keyColumn: 'scenario', list: true },
  'cloth_drawable_albedo_normal_material_TEMPORARY.lua': { keyColumn: 'hash', valueColumn: 'name' },
  'overlay_cloth_items.lua': { keyColumn: 'hash', valueColumn: 'name' },
  'metaped_outfits.lua': { keyColumn: 'model', list: true },
  'imaps_with_coords_and_heading.lua': { keyColumn: 'hash' },
  'interiors_coords_and_hashes.lua': { keyColumn: 'interior_id' },
  'events.lua': { keyColumn: 'hash' },
  'object_list.lua': { keyColumn: 'hash', valueColumn: 'model' },
  'vehicles_list.lua': { keyColumn: 'hash', valueColumn: 'model' },
  'shocking_events.lua': { keyColumn: 'hash' },
  'cloth_color_palletes.lua': { keyColumn: 'hash' },
  'explosion_vfxTags.lua': { keyColumn: 'hash' },
  'marker_types.lua': { keyColumn: 'hash' },
};

const SKIP_DIRS = new Set(['.git', '.github']);
const human = (s: string) => s.replace(/_{2,}/g, ' · ').replace(/_/g, ' ').replace(/\.(lua|md)$/i, '').trim();

type Dataset = {
  id: string; category_path: string; title: string; kind: 'table' | 'list' | 'code';
  source_file: string; columns: string[]; notes_md: string; code: string | null; rows: Row[]; sort: number;
};

const categories = new Map<string, { path: string; parent_path: string | null; title: string; intro: string[]; sort: number }>();
const datasets: Dataset[] = [];
const refs = new Map<string, { native_hash: string; category_path: string; dataset_id: string | null }>();

async function walk(dir: string, rel: string, sort: number) {
  const names = (await readdir(dir)).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  if (rel) {
    const parent = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : null;
    categories.set(rel, { path: rel, parent_path: parent, title: human(path.basename(rel)), intro: [], sort });
  }
  let i = 0;
  for (const name of names) {
    const full = path.join(dir, name);
    const s = await stat(full);
    const childRel = rel ? `${rel}/${name}` : name;
    if (s.isDirectory()) { if (!SKIP_DIRS.has(name)) await walk(full, childRel, i++); continue; }
    if (!rel) continue; // top-level README is the repo index, not content
    await ingestFile(full, rel, name);
  }
}

async function ingestFile(full: string, cat: string, name: string) {
  const text = await readFile(full, 'utf8');
  const lower = name.toLowerCase();
  const base = datasets.filter(d => d.category_path === cat).length;
  const id = (n: number) => `${cat}#${base + n}`;
  if (lower.endsWith('.md')) return ingestMarkdown(text, cat, name, id);

  const tables = lower.endsWith('.lua') ? parseLuaTables(text) : null;
  const dataTables = tables?.filter(t => t.fields.length >= 3) ?? [];
  if (!dataTables.length) {
    datasets.push({ id: id(0), category_path: cat, title: human(name), kind: 'code', source_file: name,
      columns: [], notes_md: '', code: text, rows: [], sort: base });
    scanRefs(text, cat, id(0));
    return;
  }
  dataTables.forEach((t, n) => {
    const hints = HINTS[name] ?? {};
    const shaped = shapeFields(t.fields, { tupleColumns: tupleColumnsFromComment(t.headerComment), ...hints });
    datasets.push({
      id: id(n), category_path: cat, kind: shaped.grouped ? 'list' : 'table', source_file: name,
      title: dataTables.length > 1 ? `${human(name)} · ${t.name}` : human(name),
      columns: shaped.columns, notes_md: t.headerComment ? '```\n' + t.headerComment + '\n```' : '',
      code: null, rows: shaped.rows, sort: base + n,
    });
  });
  scanRefs(text, cat, id(0));
}

function cellText(md: string) {
  // Keep markdown (images, links) for display; strip <br> noise.
  return md.replace(/<br\s*\/?>/gi, ' ').trim();
}

function ingestMarkdown(text: string, cat: string, name: string, id: (n: number) => string) {
  const tokens = marked.lexer(text, { gfm: true });
  const intro: string[] = [];
  let heading = '';
  let pending: string[] = []; // text since the last heading, attached to the next table
  let n = 0;
  for (const tok of tokens) {
    if (tok.type === 'heading') { heading = tok.text.replace(/<[^>]+>/g, '').trim(); pending = []; intro.push(tok.raw); continue; }
    if (tok.type === 'html' && /<h[1-6][^>]*>/i.test(tok.raw)) {
      heading = tok.raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || heading;
      intro.push(tok.raw); pending = []; continue;
    }
    if (tok.type === 'table') {
      const t = tok as Tokens.Table;
      const columns = uniqueCols(t.header.map(h => cellText(h.text) || 'value'));
      const rows: Row[] = t.rows
        .map(r => Object.fromEntries(columns.map((c, i) => [c, cellText(r[i]?.text ?? '')])))
        .filter(c => Object.values(c).some(v => v !== ''))
        .map(cells => ({ cells }));
      if (!rows.length) continue;
      // Runs of small tables with the same columns (Controls has ~100) read better as one
      // table with a section column.
      const prev = datasets.at(-1);
      const sameShape = (a: string[], b: string[]) => a.join('|') === b.filter(c => c !== 'section').join('|');
      if (prev && n > 0 && prev.category_path === cat && prev.source_file === name && sameShape(columns, prev.columns) && rows.length < 40) {
        if (!prev.columns.includes('section')) {
          prev.rows.forEach(r => { r.cells = { section: prev.title, ...r.cells }; });
          prev.columns = ['section', ...prev.columns];
          prev.title = human(name) === 'README' ? categories.get(cat)!.title : prev.title;
        }
        rows.forEach(r => { r.cells = { section: heading, ...r.cells }; });
        prev.rows.push(...rows);
        pending = [];
        continue;
      }
      const dsId = id(n);
      datasets.push({ id: dsId, category_path: cat, kind: 'table', source_file: name,
        title: cleanTitle(heading) || human(name), columns, notes_md: pending.join('\n').trim(), code: null, rows, sort: Number(dsId.split('#')[1]) });
      intro.push(`\n<!--dataset:${dsId}-->\n`);
      n++; pending = [];
      continue;
    }
    if (tok.type !== 'space') pending.push(tok.raw);
    intro.push(tok.raw);
  }
  categories.get(cat)!.intro.push(intro.join(''));
  scanRefs(text, cat, null);
}

function cleanTitle(h: string) {
  return h.replace(/\[?download full pack.*$/i, '').replace(/^Texture dictionary hashname \(hash\):\s*/i, '')
    .replace(/[:\s]+$/, '').trim();
}

function uniqueCols(cols: string[]) {
  const seen = new Map<string, number>();
  return cols.map(c => {
    const k = c.replace(/\s+/g, ' ');
    const n = seen.get(k) ?? 0; seen.set(k, n + 1);
    return n ? `${k} (${n + 1})` : k;
  });
}

const nativeByPascal = new Map<string, string>();
let nativeHashes = new Set<string>();
function scanRefs(text: string, cat: string, dataset: string | null) {
  const add = (h: string) => { if (nativeHashes.has(h)) refs.set(`${h}|${cat}`, { native_hash: h, category_path: cat, dataset_id: dataset }); };
  for (const m of text.matchAll(/0x[0-9a-fA-F]{13,16}\b/g)) add(normNativeHash(m[0]));
  for (const m of text.matchAll(/\b([A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+)\s*\(/g)) {
    const h = nativeByPascal.get(m[1]); if (h) add(h);
  }
  for (const m of text.matchAll(/\b([A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+)\b/g)) {
    const h = nativeByPascal.get(m[1]); if (h) add(h);
  }
}

const pascal = (name: string) => name.replace(/^_/, '').toLowerCase().split('_').filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1)).join('');

function searchText(r: Row): string {
  const parts: string[] = [];
  for (const v of Object.values(r.cells)) {
    const plain = v.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    parts.push(plain);
    const u = parseHash32(plain);
    if (u !== null && plain.length > 4) parts.push(...hashForms(u));
  }
  if (r.items) parts.push(r.items.join(' '));
  return parts.join(' ').toLowerCase();
}

async function main() {
  for (const n of await sql<{ hash: string; name: string }[]>`select hash, name from natives where is_named`) {
    const p = pascal(n.name);
    if (/[A-Z][a-z0-9]*[A-Z]/.test(p)) nativeByPascal.set(p, n.hash); // skip one-word names like Wait
    if (n.name.replace(/^_/, '').includes('_')) nativeByPascal.set(n.name.replace(/^_/, ''), n.hash);
  }
  nativeHashes = new Set((await sql<{ hash: string }[]>`select hash from natives`).map(r => r.hash));

  await walk(ROOT, '', 0);

  await sql.begin(async tx => {
    await tx`delete from categories`;
    const cats = [...categories.values()];
    // Parents first so the FK holds.
    cats.sort((a, b) => a.path.split('/').length - b.path.split('/').length);
    for (const c of cats) {
      await tx`insert into categories (path, parent_path, title, intro_md, sort)
               values (${c.path}, ${c.parent_path}, ${c.title}, ${c.intro.join('\n\n')}, ${c.sort})`;
    }
    for (const d of datasets) {
      await tx`insert into datasets (id, category_path, title, kind, source_file, columns, notes_md, code, row_count, sort)
               values (${d.id}, ${d.category_path}, ${d.title}, ${d.kind}, ${d.source_file}, ${tx.json(d.columns)},
                       ${d.notes_md}, ${d.code}, ${d.rows.length}, ${d.sort})`;
      for (let i = 0; i < d.rows.length; i += 2000) {
        const chunk = d.rows.slice(i, i + 2000).map((r, j) => ({
          dataset_id: d.id, ord: i + j, cells: tx.json(r.cells), items: r.items ? tx.json(r.items) : null, search_text: searchText(r),
        }));
        await tx`insert into entries ${tx(chunk, 'dataset_id', 'ord', 'cells', 'items', 'search_text')}`;
      }
    }
    const refRows = [...refs.values()];
    if (refRows.length) await tx`insert into native_refs ${tx(refRows, 'native_hash', 'category_path', 'dataset_id')}`;
  });

  const rows = datasets.reduce((s, d) => s + d.rows.length, 0);
  console.log(`categories ${categories.size}, datasets ${datasets.length} (${datasets.filter(d => d.kind === 'code').length} code), rows ${rows}, native refs ${refs.size}`);
  await sql.end();
}
main().catch(e => { console.error(e); process.exit(1); });

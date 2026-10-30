import { NextResponse } from 'next/server';
import { sql, likeEscape, type Entry } from '@/lib/db';
import { parseHash32, toHex } from '@/lib/hash';

const PAGE = 100;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const dataset = sp.get('dataset') ?? '';
  const q = (sp.get('q') ?? '').trim().toLowerCase().slice(0, 100);
  const page = Math.max(0, Number(sp.get('page')) || 0);
  const h = parseHash32(q);
  const pat = q ? '%' + likeEscape(h !== null && q.length > 4 ? toHex(h).toLowerCase() : q) + '%' : null;
  const [rows, [{ total }]] = await Promise.all([
    sql<Entry[]>`select id, ord, cells, items from entries
                 where dataset_id = ${dataset} ${pat ? sql`and search_text like ${pat}` : sql``}
                 order by ord limit ${PAGE} offset ${page * PAGE}`,
    sql<{ total: number }[]>`select count(*)::int total from entries
                 where dataset_id = ${dataset} ${pat ? sql`and search_text like ${pat}` : sql``}`,
  ]);
  return NextResponse.json({ rows, total, page, pageSize: PAGE }, { headers: { 'cache-control': 'public, max-age=300' } });
}

import 'server-only';
import { sql, type Category, type Dataset, type Entry } from './db';

export const PAGE_SIZE = 100;

export async function categoryTree() {
  return sql<(Category & { datasets: number; rows: number })[]>`
    select c.path, c.parent_path, c.title, '' intro_md, c.sort,
           count(d.id)::int datasets, coalesce(sum(d.row_count), 0)::int rows
    from categories c left join datasets d on d.category_path = c.path
    group by c.path order by c.path`;
}

export async function entriesPage(datasetId: string, page: number) {
  const rows = await sql<Entry[]>`select id, ord, cells, items from entries where dataset_id = ${datasetId}
                                  order by ord limit ${PAGE_SIZE} offset ${page * PAGE_SIZE}`;
  return rows;
}

export async function loadCategory(path: string) {
  const [cat] = await sql<Category[]>`select * from categories where path = ${path}`;
  if (!cat) return null;
  const [datasets, children, refs] = await Promise.all([
    sql<Dataset[]>`select * from datasets where category_path = ${path} order by sort, id`,
    sql<{ path: string; title: string; rows: number }[]>`
      select c.path, c.title, coalesce(sum(d.row_count), 0)::int rows from categories c
      left join datasets d on d.category_path like c.path || '%'
      where c.parent_path = ${path} group by c.path order by c.sort, c.path`,
    sql<{ hash: string; name: string }[]>`
      select n.hash, n.name from native_refs r join natives n on n.hash = r.native_hash
      where r.category_path = ${path} order by n.name`,
  ]);
  return { cat, datasets, children, refs };
}

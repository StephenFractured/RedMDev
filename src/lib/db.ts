import 'server-only';
import postgres from 'postgres';

const g = globalThis as unknown as { __sql?: postgres.Sql };
const url = process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/redmdev';
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
export const sql = g.__sql ?? postgres(url, { max: 10, prepare: false, onnotice: () => {}, ssl: local ? false : 'require' });
if (process.env.NODE_ENV !== 'production') g.__sql = sql;

export type NativeRow = {
  hash: string; name: string; namespace: string; params: { type: string; name: string }[];
  return_type: string; comment: string; build: string | null; examples: { lang: string; code: string }[];
  apiset: string; is_named: boolean;
};
export type Category = { path: string; parent_path: string | null; title: string; intro_md: string; sort: number };
export type Dataset = {
  id: string; category_path: string; title: string; kind: 'table' | 'list' | 'code'; source_file: string;
  columns: string[]; notes_md: string; code: string | null; row_count: number; sort: number;
};
export type Entry = { id: number; ord: number; cells: Record<string, string>; items: string[] | null };

/** Escape LIKE wildcards in user input. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, m => '\\' + m);

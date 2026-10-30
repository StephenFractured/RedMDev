// Flattens parsed Lua fields into table rows (cells) or grouped lists (items).
import type { LuaField, LuaValue, Scalar } from './lua';

export type Row = { cells: Record<string, string>; items?: string[] };
export type Shaped = { columns: string[]; rows: Row[]; grouped: boolean };

const isScalar = (v: LuaValue): v is Scalar => v === null || typeof v !== 'object';
const str = (v: LuaValue): string => isScalar(v) ? (v === null ? 'nil' : String(v)) : JSON.stringify(v);
/** {0x123} style one-element wrappers count as the scalar inside. */
const unwrap = (v: LuaValue): LuaValue => Array.isArray(v) && v.length === 1 && isScalar(v[0]) ? v[0] : v;
const isRecord = (v: LuaValue): v is Record<string, LuaValue> => !!v && typeof v === 'object' && !Array.isArray(v);

export type ShapeHints = { keyColumn?: string; valueColumn?: string; tupleColumns?: string[]; list?: boolean };

/** Column names from a format comment such as '[doorhash] = {doorhash, doormodel hash, x, y, z}'. */
export function tupleColumnsFromComment(comment: string): string[] | undefined {
  const m = comment.match(/\{\s*([A-Za-z_][\w ]*(?:\s*,\s*[A-Za-z_][\w ]*){1,11})\s*,?\s*\}/);
  return m ? m[1].split(',').map(s => s.trim().replace(/\s+/g, '_')) : undefined;
}

export function shapeFields(fields: LuaField[], hints: ShapeHints = {}): Shaped {
  const keyCol = hints.keyColumn ?? 'key';
  const valCol = hints.valueColumn ?? 'value';
  const columns: string[] = [];
  const col = (c: string) => { if (!columns.includes(c)) columns.push(c); return c; };
  const rows: Row[] = [];
  let grouped = false;

  for (const f of fields) {
    // Under a key, a one-item list is still a list (an anim dictionary with one clip).
    const v = f.key !== null && hints.list ? f.value : unwrap(f.value);
    const cells: Record<string, string> = {};
    if (f.key !== null) cells[col(keyCol)] = f.key;
    let items: string[] | undefined;

    if (isScalar(v)) {
      cells[col(f.key === null ? (hints.keyColumn ?? 'name') : valCol)] = str(v);
    } else if (Array.isArray(v)) {
      const vals = v.map(unwrap);
      const allScalar = vals.every(isScalar);
      const mixed = allScalar && new Set(vals.map(x => typeof x === 'string' && !/^-?(0x)?[\d.a-f]+$/i.test(x) ? 's' : 'n')).size > 1;
      if (allScalar && !hints.list && (hints.tupleColumns || mixed) && vals.length <= 12) {
        vals.forEach((x, i) => { cells[col(hints.tupleColumns?.[i] ?? `#${i + 1}`)] = str(x); });
      } else if (allScalar) {
        items = vals.map(str); grouped = true;
        cells[col('count')] = String(items.length);
      } else if (vals.length === 1 && isRecord(vals[0])) {
        flattenRecord(vals[0], cells, col);
      } else if (vals.every(isRecord)) {
        // Several records under one key: one row each.
        for (const r of vals as Record<string, LuaValue>[]) {
          const c2 = { ...cells };
          flattenRecord(r, c2, col);
          if (f.note) c2[col('note')] = f.note;
          rows.push({ cells: c2 });
        }
        continue;
      } else {
        cells[col(valCol)] = JSON.stringify(v);
      }
    } else {
      flattenRecord(v, cells, col);
    }
    if (f.note) cells[col('note')] = f.note;
    rows.push({ cells, items });
  }
  // Keep the note column last.
  const ordered = columns.filter(c => c !== 'note').concat(columns.includes('note') ? ['note'] : []);
  return { columns: ordered, rows, grouped };
}

function flattenRecord(r: Record<string, LuaValue>, cells: Record<string, string>, col: (c: string) => string) {
  for (const [k, x] of Object.entries(r)) {
    if (isRecord(x) && Object.values(x).every(isScalar) && Object.keys(x).length <= 4) {
      for (const [k2, y] of Object.entries(x)) cells[col(`${k}.${k2}`)] = str(y);
    } else {
      cells[col(k)] = str(unwrap(x));
    }
  }
}

// Turns the data tables in rdr3_discoveries Lua files into rows, keeping the trailing
// comments (which usually hold the hash in hex/decimal or a description).
/* eslint-disable @typescript-eslint/no-explicit-any */
import luaparse from 'luaparse';

export type Scalar = string | number | boolean | null;
export type LuaValue = Scalar | LuaValue[] | { [k: string]: LuaValue };
export type LuaField = { key: string | null; value: LuaValue; note: string };
export type LuaTable = { name: string; fields: LuaField[]; headerComment: string };

/** Make RedM/Lua 5.4 dialect parseable without shifting any character offsets. */
function sanitize(src: string): string {
  return src
    .replace(/^```.*$/gm, m => ' '.repeat(m.length))  // stray markdown fences
    .replace(/`([^`\n]*)`/g, '"$1"')                 // backtick hash literals
    .replace(/<(const|close)>/g, m => ' '.repeat(m.length));
}

/** Upstream files occasionally miss a comma between two table rows; patch those and retry. */
function parseLenient(text: string, opts: object): { ast: any; text: string } | null {
  for (let tries = 0; tries < 5000; tries++) {
    try {
      return { ast: luaparse.parse(text, opts as any), text };
    } catch (e: any) {
      if (!/'}' expected near '\{'/.test(e.message) || typeof e.index !== 'number') return null;
      text = text.slice(0, e.index) + ',' + text.slice(e.index);
    }
  }
  return null;
}

export function parseLuaTables(src: string, minFields = 3): LuaTable[] | null {
  const parsed = parseLenient(sanitize(src), { comments: true, locations: true, ranges: true, luaVersion: '5.3', encodingMode: 'pseudo-latin1' });
  if (!parsed) return parseLineByLine(src);
  const { ast, text } = parsed;
  const lines = text.split('\n');
  const commentsByLine = new Map<number, string[]>();
  for (const c of ast.comments ?? []) {
    const line = c.loc.start.line;
    const v = String(c.value).trim();
    if (!v) continue;
    commentsByLine.set(line, [...(commentsByLine.get(line) ?? []), v]);
  }
  const src_ = (n: any) => text.slice(n.range[0], n.range[1]);

  const value = (n: any): LuaValue => {
    switch (n.type) {
      case 'StringLiteral': {
        const raw = src_(n);
        return raw.startsWith('[') ? raw.replace(/^\[=*\[|\]=*\]$/g, '') : raw.slice(1, -1);
      }
      case 'NumericLiteral': return src_(n);
      case 'BooleanLiteral': return n.value;
      case 'NilLiteral': return null;
      case 'UnaryExpression':
        if (n.operator === '-' && n.argument.type === 'NumericLiteral') return '-' + src_(n.argument);
        return src_(n);
      case 'TableConstructorExpression': {
        const keyed = n.fields.some((f: any) => f.type !== 'TableValue');
        if (!keyed) return n.fields.map((f: any) => value(f.value));
        const o: Record<string, LuaValue> = {};
        let i = 1;
        for (const f of n.fields) o[f.type === 'TableValue' ? String(i++) : keyName(f)] = value(f.value);
        return o;
      }
      default: return src_(n);
    }
  };
  const keyName = (f: any): string =>
    f.type === 'TableKeyString' ? f.key.name : String(value(f.key));

  const noteFor = (n: any): string => {
    const out: string[] = [];
    for (let l = n.loc.start.line; l <= Math.min(n.loc.start.line + 1, n.loc.end.line + 0); l++) {
      out.push(...(commentsByLine.get(l) ?? []));
      if (l === n.loc.start.line && n.loc.start.line === n.loc.end.line) break;
    }
    if (n.loc.end.line !== n.loc.start.line) out.push(...(commentsByLine.get(n.loc.end.line) ?? []));
    return [...new Set(out)].join('  ').replace(/\s+/g, ' ').trim();
  };

  const tables: LuaTable[] = [];
  let lastEnd = 0;
  for (const st of ast.body) {
    let init = st.type === 'LocalStatement' || st.type === 'AssignmentStatement' ? st.init?.[0] : null;
    // 'local x = {..}, {..}, {..}' (missing outer braces): treat the expressions as the rows.
    if (init && st.init.length >= Math.max(2, minFields) && st.init.every((e: any) => e.type === 'TableConstructorExpression')) {
      init = { type: 'TableConstructorExpression', fields: st.init.map((e: any) => ({ type: 'TableValue', value: e, loc: e.loc, range: e.range })) };
    }
    if (!init || init.type !== 'TableConstructorExpression' || init.fields.length < minFields) continue;
    const name = st.variables?.[0] ? src_(st.variables[0]) : 'table';
    // Comments between the previous table and this one describe the format.
    // Also comments inside the braces before the first row (e.g. '-- {hash, name, outfits}').
    const firstField = init.fields[0]?.range[0] ?? st.range[1];
    const header = (ast.comments ?? [])
      .filter((c: any) => c.range[0] >= lastEnd && c.range[1] <= firstField)
      .map((c: any) => String(c.value).replace(/^-+$/, '').trimEnd())
      .filter((s: string) => s.trim())
      .join('\n');
    lastEnd = st.range[1];
    tables.push({
      name, headerComment: header,
      fields: init.fields.map((f: any) => ({
        key: f.type === 'TableValue' ? null : keyName(f),
        value: value(f.value),
        note: noteFor(f),
      })),
    });
  }
  void lines;
  return tables;
}

/**
 * Fallback for files with a few malformed rows: when every row sits on its own line,
 * parse each line alone and skip the ones that don't parse.
 */
function parseLineByLine(src: string): LuaTable[] | null {
  const text = sanitize(src);
  const fields: LuaField[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*((?:\{.*\}|\[[^\]]+\]\s*=\s*[^{\s].*?))\s*,?\s*(?:--(.*))?$/);
    if (!m) continue;
    const t = parseLuaTables(`local __row = { ${m[1]}, nil, nil }`, 1)?.[0];
    const f = t?.fields[0];
    if (f) fields.push({ ...f, note: (m[2] ?? '').trim() });
  }
  if (fields.length < 20) return null;
  return [{ name: text.match(/local\s+(\w+)\s*=/)?.[1] ?? 'table', fields, headerComment: '' }];
}

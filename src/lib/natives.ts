import type { NativeRow } from './db';

/** RedM exposes named natives to Lua/JS in PascalCase, unnamed ones as N_0x<hash>. */
export function pascalName(n: Pick<NativeRow, 'name' | 'hash'>): string {
  if (n.name.startsWith('_0x')) return `N_${n.hash.toLowerCase()}`;
  return n.name.replace(/^_/, '').toLowerCase().split('_').filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1)).join('');
}

export const nativeSlug = (hash: string) => hash.toLowerCase();

const csType: Record<string, string> = {
  BOOL: 'bool', int: 'int', float: 'float', Hash: 'uint', 'const char*': 'string', void: 'void',
  Any: 'int', Ped: 'int', Entity: 'int', Vehicle: 'int', Object: 'int', Player: 'int', Blip: 'int',
  Cam: 'int', Vector3: 'Vector3', Interior: 'int', Volume: 'int', ItemSet: 'int', PropSet: 'int',
  AnimScene: 'int', PersChar: 'int', Prompt: 'int', PopZone: 'int', FireId: 'int', ScrHandle: 'int',
};

export function signature(n: NativeRow): string {
  const params = n.params.map(p => `${p.type} ${p.name}`).join(', ');
  return `${n.return_type} ${n.name}(${params})`;
}

export function snippets(n: NativeRow): { lang: string; label: string; code: string }[] {
  const args = n.params.map(p => p.name);
  const ret = n.return_type === 'void' ? '' : 'local result = ';
  const jsRet = n.return_type === 'void' ? '' : 'const result = ';
  const pascal = pascalName(n);
  const out = [
    { lang: 'lua', label: 'Lua', code: `${ret}${pascal}(${args.join(', ')})` },
    { lang: 'lua', label: 'Lua (InvokeNative)', code: `${ret}Citizen.InvokeNative(${n.hash}${args.map(a => ', ' + a).join('')})` },
    { lang: 'javascript', label: 'JS', code: `${jsRet}${pascal}(${args.join(', ')});` },
  ];
  const t = csType[n.return_type] ?? (n.return_type.endsWith('*') ? 'int' : 'int');
  const generic = n.return_type === 'void' ? '' : `<${t}>`;
  out.push({ lang: 'csharp', label: 'C#', code: `${n.return_type === 'void' ? '' : 'var result = '}Function.Call${generic}((Hash)${n.hash}${args.map(a => ', ' + a).join('')});` });
  return out;
}

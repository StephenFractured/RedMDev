'use client';
import { useState } from 'react';
import Link from 'next/link';
import { joaat, parseHash32, toHex, toSigned, toUnsigned } from '@/lib/hash';
import CopyButton from '@/components/CopyButton';

export default function HashTool({ initial }: { initial: string }) {
  const [text, setText] = useState(initial || 'p_door_photo02x\nBLIP_AMBIENT_HORSE\n-861219276');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 200);
  return (
    <div className="mt-4 space-y-4">
      <textarea value={text} onChange={e => setText(e.target.value)} rows={5} className="mono w-full rounded-lg border border-border bg-panel p-3 text-sm outline-none focus:border-accent" />
      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel-2 text-xs text-muted"><tr><th className="px-3 py-2">Input</th><th className="px-3 py-2">Read as</th><th className="px-3 py-2">Hex</th><th className="px-3 py-2">Signed</th><th className="px-3 py-2">Unsigned</th><th /></tr></thead>
          <tbody className="divide-y divide-border">
            {lines.map((l, i) => {
              const parsed = parseHash32(l);
              const u = parsed ?? joaat(l.replace(/^`|`$/g, ''));
              return (
                <tr key={i}>
                  <td className="mono px-3 py-1.5">{l}</td>
                  <td className="px-3 py-1.5 text-xs text-muted">{parsed !== null ? 'number' : 'joaat(name)'}</td>
                  {[toHex(u), String(toSigned(u)), String(toUnsigned(u))].map((v, j) => (
                    <td key={j} className="mono px-3 py-1.5"><span className="mr-1.5">{v}</span><CopyButton text={v} /></td>
                  ))}
                  <td className="px-3 py-1.5"><Link className="text-xs text-accent underline" href={`/search?q=${encodeURIComponent(toHex(u))}`}>Find</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

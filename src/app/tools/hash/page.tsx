import type { Metadata } from 'next';
import HashTool from './HashTool';

export const metadata: Metadata = { title: 'Hash tool', description: 'joaat / GetHashKey calculator and hex, signed and unsigned converter for RedM.' };

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Hash tool</h1>
      <p className="mt-1 text-sm text-muted">Type a name to get its joaat hash (same as <span className="mono">GetHashKey</span> or a backtick literal), or paste a hash in any form to convert it. One per line works too.</p>
      <HashTool initial={(await searchParams).s ?? ''} />
    </div>
  );
}

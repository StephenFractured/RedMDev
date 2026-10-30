import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-muted">That page doesn&apos;t exist. Try searching with <kbd className="rounded border border-border px-1 text-xs">Ctrl K</kbd>.</p>
      <Link href="/" className="mt-4 inline-block text-accent underline">Home</Link>
    </div>
  );
}

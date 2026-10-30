import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { currentUser } from '@/lib/auth';
import { signOut } from './actions';
import CommandPalette from '@/components/CommandPalette';

export const metadata: Metadata = {
  title: { default: 'RedMDev · RedM natives & discoveries', template: '%s · RedMDev' },
  description: 'Search RDR3 / RedM natives and the rdr3_discoveries dictionary in one place, with community examples.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-sm font-bold text-accent-fg">R</span>
              <span className="hidden sm:inline">RedMDev</span>
            </Link>
            <nav className="flex min-w-0 items-center text-sm sm:gap-1">
              <Link className="rounded-md px-2 py-1.5 text-muted hover:bg-panel-2 hover:text-fg sm:px-2.5" href="/natives">Natives</Link>
              <Link className="rounded-md px-2 py-1.5 text-muted hover:bg-panel-2 hover:text-fg sm:px-2.5" href="/d">Discoveries</Link>
              <Link className="hidden rounded-md px-2.5 py-1.5 text-muted hover:bg-panel-2 hover:text-fg sm:block" href="/tools/hash">Hash tool</Link>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <CommandPalette />
              {user ? (
                <form action={signOut} className="flex items-center gap-2 text-sm">
                  <span className="hidden text-muted md:inline">{user.username}</span>
                  <button className="rounded-md px-2 py-1.5 text-muted hover:bg-panel-2 hover:text-fg">Sign out</button>
                </form>
              ) : (
                <Link href="/login" className="whitespace-nowrap rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:opacity-90">Sign in</Link>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 py-10 text-xs text-muted">
          Natives from <a className="underline" href="https://github.com/VORPCORE/RDR3natives">VORPCORE/RDR3natives</a> and{' '}
          <a className="underline" href="https://github.com/alloc8or/rdr3-nativedb-data">alloc8or&apos;s native DB</a>. Discoveries from{' '}
          <a className="underline" href="https://github.com/femga/rdr3_discoveries">femga/rdr3_discoveries</a> and its contributors.
        </footer>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { devAuthEnabled, supabaseEnabled } from '@/lib/auth';
import { signIn } from '../actions';

export const metadata: Metadata = { title: 'Sign in' };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto mt-10 max-w-sm rounded-xl border border-border bg-panel p-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Sign in to post examples, comment and vote.</p>
      {sp.error && <p className="mt-3 text-sm text-accent">{sp.error === 'name' ? 'Use 2–32 letters, numbers, spaces, dots or dashes.' : 'Sign-in failed. Try again.'}</p>}
      {supabaseEnabled && (
        <div className="mt-5 space-y-2">
          {(['discord', 'github'] as const).map(p => (
            <form key={p} action={signIn}>
              <input type="hidden" name="provider" value={p} />
              <input type="hidden" name="next" value={sp.next ?? '/'} />
              <button className={`w-full rounded-md px-3 py-2 font-medium ${p === 'discord' ? 'bg-[#5865F2] text-white' : 'border border-border'}`}>
                Continue with {p === 'discord' ? 'Discord' : 'GitHub'}
              </button>
            </form>
          ))}
        </div>
      )}
      {devAuthEnabled && (
        <form action={signIn} className="mt-5 space-y-2">
          <p className="rounded-md bg-gold/10 p-2 text-xs text-gold">Development mode: Supabase isn&apos;t configured, so you can sign in with any name.</p>
          <input type="hidden" name="next" value={sp.next ?? '/'} />
          <input name="username" required placeholder="Your name" className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm" />
          <button className="w-full rounded-md bg-accent px-3 py-2 font-medium text-accent-fg">Sign in</button>
        </form>
      )}
      {!supabaseEnabled && !devAuthEnabled && <p className="mt-4 text-sm text-muted">Sign-in isn&apos;t configured on this server yet.</p>}
    </div>
  );
}

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/auth';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  if (code) await (await supabaseServer()).auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(next.startsWith('/') && !next.startsWith('//') ? next : '/', url.origin));
}

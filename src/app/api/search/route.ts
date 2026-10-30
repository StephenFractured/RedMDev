import { NextResponse } from 'next/server';
import { search } from '@/lib/search';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  return NextResponse.json(await search(q), { headers: { 'cache-control': 'public, max-age=60' } });
}

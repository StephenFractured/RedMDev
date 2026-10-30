'use server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { currentUser, devAuthEnabled, DEV_COOKIE, supabaseEnabled, supabaseServer } from '@/lib/auth';

const target = z.object({
  target_type: z.enum(['native', 'category']),
  target_id: z.string().min(1).max(200),
  path: z.string().startsWith('/'),
});

const newPost = target.extend({
  kind: z.enum(['comment', 'example']),
  parent_id: z.coerce.number().int().positive().optional(),
  title: z.string().max(140).optional(),
  lang: z.enum(['lua', 'js', 'cs']).optional(),
  body_md: z.string().trim().min(1, 'Write something first').max(20000),
});

export type ActionState = { error?: string; ok?: boolean };

async function targetExists(type: string, id: string) {
  const [row] = type === 'native'
    ? await sql`select 1 from natives where hash = ${id}`
    : await sql`select 1 from categories where path = ${id}`;
  return !!row;
}

export async function createPost(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: 'Sign in to post.' };
  const parsed = newPost.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => v !== '')));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const p = parsed.data;
  if (!(await targetExists(p.target_type, p.target_id))) return { error: 'That page no longer exists.' };
  // Simple flood control: 10 posts per 5 minutes.
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int n from posts where author_id = ${user.id} and created_at > now() - interval '5 minutes'`;
  if (n >= 10) return { error: 'Slow down a little, then try again.' };
  const body = p.kind === 'example' && p.lang && !p.body_md.includes('```') ? '```' + p.lang + '\n' + p.body_md + '\n```' : p.body_md;
  await sql`insert into posts (target_type, target_id, kind, parent_id, author_id, title, lang, body_md)
            values (${p.target_type}, ${p.target_id}, ${p.parent_id ? 'comment' : p.kind}, ${p.parent_id ?? null}, ${user.id},
                    ${p.title ?? null}, ${p.lang ?? null}, ${body})`;
  revalidatePath(p.path);
  return { ok: true };
}

export async function editPost(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: 'Sign in first.' };
  const id = Number(form.get('id'));
  const body = String(form.get('body_md') ?? '').trim();
  const path = String(form.get('path') ?? '/');
  if (!body || body.length > 20000) return { error: 'Post must be 1–20,000 characters.' };
  const [post] = await sql<{ author_id: string; body_md: string }[]>`select author_id, body_md from posts where id = ${id}`;
  if (!post) return { error: 'Post not found.' };
  if (post.author_id !== user.id && user.role === 'member') return { error: 'You can only edit your own posts.' };
  await sql.begin(async tx => {
    await tx`insert into post_revisions (post_id, body_md) values (${id}, ${post.body_md})`;
    await tx`update posts set body_md = ${body}, edited_at = now() where id = ${id}`;
  });
  revalidatePath(path.startsWith('/') ? path : '/');
  return { ok: true };
}

export async function vote(postId: number, value: -1 | 0 | 1, path: string) {
  const user = await currentUser();
  if (!user) return { error: 'Sign in to vote.' };
  await sql.begin(async tx => {
    if (value === 0) await tx`delete from votes where post_id = ${postId} and user_id = ${user.id}`;
    else await tx`insert into votes (post_id, user_id, value) values (${postId}, ${user.id}, ${value})
                  on conflict (post_id, user_id) do update set value = excluded.value`;
    await tx`update posts set score = coalesce((select sum(value) from votes where post_id = ${postId}), 0) where id = ${postId}`;
  });
  revalidatePath(path);
  return {};
}

export async function reportPost(postId: number, reason: string) {
  const user = await currentUser();
  if (!user) return { error: 'Sign in to report.' };
  await sql`insert into reports (post_id, user_id, reason) values (${postId}, ${user.id}, ${reason.slice(0, 500)}) on conflict do nothing`;
  return {};
}

export async function setHidden(postId: number, hidden: boolean, path: string) {
  const user = await currentUser();
  if (!user || user.role === 'member') return { error: 'Moderators only.' };
  await sql`update posts set hidden = ${hidden} where id = ${postId}`;
  revalidatePath(path);
  return {};
}

export async function deletePost(postId: number, path: string) {
  const user = await currentUser();
  if (!user) return { error: 'Sign in first.' };
  const [post] = await sql<{ author_id: string }[]>`select author_id from posts where id = ${postId}`;
  if (!post || (post.author_id !== user.id && user.role === 'member')) return { error: 'Not allowed.' };
  await sql`delete from posts where id = ${postId}`;
  revalidatePath(path);
  return {};
}

export async function signIn(form: FormData) {
  const next = String(form.get('next') ?? '/');
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  if (supabaseEnabled) {
    const provider = form.get('provider') === 'github' ? 'github' : 'discord';
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const { data, error } = await (await supabaseServer()).auth.signInWithOAuth({
      provider, options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}` },
    });
    if (error || !data.url) redirect('/login?error=1');
    redirect(data.url);
  }
  if (!devAuthEnabled) redirect('/login?error=1');
  const name = String(form.get('username') ?? '').trim().slice(0, 32);
  if (!/^[\w .-]{2,32}$/.test(name)) redirect('/login?error=name');
  (await cookies()).set(DEV_COOKIE, name, { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect(safeNext);
}

export async function signOut() {
  if (supabaseEnabled) await (await supabaseServer()).auth.signOut();
  (await cookies()).delete(DEV_COOKIE);
  redirect('/');
}

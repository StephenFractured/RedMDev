import 'server-only';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { createServerClient } from '@supabase/ssr';
import { sql } from './db';

export type User = { id: string; username: string; avatar_url: string | null; role: 'member' | 'mod' | 'admin' };

export const supabaseEnabled = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
/** Local development without Supabase: sign in with just a name. Never on in production. */
export const devAuthEnabled = !supabaseEnabled && process.env.NODE_ENV !== 'production';
export const DEV_COOKIE = 'redref_dev_user';

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: list => { try { list.forEach(c => store.set(c.name, c.value, c.options)); } catch { /* read-only in RSC */ } },
    },
  });
}

/** uuid-shaped id derived from a dev username so the same name maps to the same profile. */
const devId = (name: string) => {
  const h = createHash('sha1').update('redref-dev:' + name.toLowerCase()).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

export async function currentUser(): Promise<User | null> {
  let id: string, username: string, avatar: string | null = null;
  if (supabaseEnabled) {
    const { data } = await (await supabaseServer()).auth.getUser();
    if (!data.user) return null;
    const meta = data.user.user_metadata ?? {};
    id = data.user.id;
    username = meta.full_name || meta.custom_claims?.global_name || meta.name || meta.user_name || data.user.email?.split('@')[0] || 'user';
    avatar = meta.avatar_url ?? null;
  } else if (devAuthEnabled) {
    const name = (await cookies()).get(DEV_COOKIE)?.value;
    if (!name) return null;
    id = devId(name); username = name;
  } else {
    return null;
  }
  const [row] = await sql<User[]>`
    insert into profiles (id, username, avatar_url) values (${id}, ${username}, ${avatar})
    on conflict (id) do update set username = excluded.username, avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url)
    returning id, username, avatar_url, role`;
  return row;
}

import 'server-only';
import { sql } from './db';

export type TargetType = 'native' | 'category';
export type Post = {
  id: number; kind: 'comment' | 'example'; parent_id: number | null; title: string | null; lang: string | null;
  body_md: string; score: number; hidden: boolean; created_at: Date; edited_at: Date | null;
  author_id: string; username: string; avatar_url: string | null; my_vote: number | null;
};

export async function postsFor(type: TargetType, id: string, viewer: string | null): Promise<Post[]> {
  return sql<Post[]>`
    select p.id, p.kind, p.parent_id, p.title, p.lang, p.body_md, p.score, p.hidden, p.created_at, p.edited_at,
           p.author_id, pr.username, pr.avatar_url,
           (select v.value from votes v where v.post_id = p.id and v.user_id = ${viewer}) as my_vote
    from posts p join profiles pr on pr.id = p.author_id
    where p.target_type = ${type} and p.target_id = ${id}
    order by p.kind = 'example' desc, case when p.kind = 'example' then -p.score end, p.created_at`;
}

export async function postCounts(type: TargetType, ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const rows = await sql<{ target_id: string; n: number }[]>`
    select target_id, count(*)::int n from posts where target_type = ${type} and target_id = any(${ids}) and not hidden group by 1`;
  return new Map(rows.map(r => [r.target_id, r.n]));
}

export type RecentPost = { id: number; kind: string; target_type: TargetType; target_id: string; title: string | null;
  body_md: string; created_at: Date; username: string; target_label: string };

export async function recentPosts(limit = 10): Promise<RecentPost[]> {
  return sql<RecentPost[]>`
    select p.id, p.kind, p.target_type, p.target_id, p.title, left(p.body_md, 240) body_md, p.created_at, pr.username,
           coalesce(n.name, c.title, p.target_id) target_label
    from posts p join profiles pr on pr.id = p.author_id
    left join natives n on p.target_type = 'native' and n.hash = p.target_id
    left join categories c on p.target_type = 'category' and c.path = p.target_id
    where not p.hidden and p.parent_id is null
    order by p.created_at desc limit ${limit}`;
}

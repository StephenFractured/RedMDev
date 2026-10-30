import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { postsFor, type Post, type TargetType } from '@/lib/posts';
import { renderMarkdown } from '@/lib/markdown';
import PostForm from './PostForm';
import PostControls from './PostControls';

function PostView({ post, replies, path, canModerate, viewer, target }: {
  post: Post; replies: Post[]; path: string; canModerate: boolean; viewer: string | null;
  target: { type: TargetType; id: string };
}) {
  if (post.hidden && !canModerate && post.author_id !== viewer) return null;
  return (
    <article id={`post-${post.id}`} className={`rounded-lg border border-border bg-panel p-4 ${post.hidden ? 'opacity-60' : ''}`}>
      <header className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        {post.kind === 'example' && <span className="rounded bg-gold/15 px-1.5 py-0.5 font-semibold text-gold">Example{post.lang ? ` · ${post.lang.toUpperCase()}` : ''}</span>}
        <span className="font-medium text-fg">{post.username}</span>
        <time dateTime={post.created_at.toISOString()}>{post.created_at.toISOString().slice(0, 10)}</time>
        {post.edited_at && <span>(edited)</span>}
        {post.hidden && <span className="text-accent">hidden by a moderator</span>}
      </header>
      {post.title && <h4 className="mb-1 font-semibold">{post.title}</h4>}
      <div className="prose text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body_md) }} />
      <PostControls post={{ id: post.id, score: post.score, my_vote: post.my_vote, body_md: post.body_md, hidden: post.hidden }}
        path={path} canEdit={viewer === post.author_id || canModerate} canModerate={canModerate} signedIn={!!viewer}
        replyForm={post.parent_id ? null : <PostForm target={target} path={path} kind="comment" parentId={post.id} compact />} />
      {replies.length > 0 && (
        <div className="mt-3 space-y-3 border-l-2 border-border pl-4">
          {replies.map(r => <PostView key={r.id} post={r} replies={[]} path={path} canModerate={canModerate} viewer={viewer} target={target} />)}
        </div>
      )}
    </article>
  );
}

export default async function Discussion({ type, id, path }: { type: TargetType; id: string; path: string }) {
  const user = await currentUser();
  const posts = await postsFor(type, id, user?.id ?? null);
  const canModerate = !!user && user.role !== 'member';
  const top = posts.filter(p => !p.parent_id);
  const replies = (pid: number) => posts.filter(p => p.parent_id === pid);
  const examples = top.filter(p => p.kind === 'example');
  const comments = top.filter(p => p.kind === 'comment');
  const target = { type, id };
  const signIn = <Link className="text-accent underline" href={`/login?next=${encodeURIComponent(path)}`}>Sign in</Link>;

  return (
    <div className="space-y-8">
      <section id="examples">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Community examples <span className="text-sm font-normal text-muted">({examples.length})</span></h2>
        </div>
        <div className="space-y-3">
          {examples.map(p => <PostView key={p.id} post={p} replies={replies(p.id)} path={path} canModerate={canModerate} viewer={user?.id ?? null} target={target} />)}
          {examples.length === 0 && <p className="text-sm text-muted">No examples yet. Share a snippet that works for you.</p>}
          {user ? <PostForm target={target} path={path} kind="example" /> : <p className="text-sm text-muted">{signIn} to add an example.</p>}
        </div>
      </section>
      <section id="comments">
        <h2 className="mb-3 text-lg font-semibold">Discussion <span className="text-sm font-normal text-muted">({comments.length})</span></h2>
        <div className="space-y-3">
          {comments.map(p => <PostView key={p.id} post={p} replies={replies(p.id)} path={path} canModerate={canModerate} viewer={user?.id ?? null} target={target} />)}
          {user ? <PostForm target={target} path={path} kind="comment" /> : <p className="text-sm text-muted">{signIn} to comment. Markdown and code blocks are supported.</p>}
        </div>
      </section>
    </div>
  );
}

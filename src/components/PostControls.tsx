'use client';
import { useActionState, useState, useTransition, type ReactNode } from 'react';
import { vote, deletePost, reportPost, setHidden, editPost, type ActionState } from '@/app/actions';

export default function PostControls({ post, path, canEdit, canModerate, signedIn, replyForm }: {
  post: { id: number; score: number; my_vote: number | null; body_md: string; hidden: boolean };
  path: string; canEdit: boolean; canModerate: boolean; signedIn: boolean; replyForm: ReactNode;
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState('');
  const [state, editAction, saving] = useActionState<ActionState, FormData>(async (s, f) => {
    const r = await editPost(s, f); if (r.ok) setEditing(false); return r;
  }, {});
  const run = (fn: () => Promise<{ error?: string }>, done?: string) =>
    start(async () => { const r = await fn(); setMsg(r.error ?? done ?? ''); });

  const btn = 'text-xs text-muted hover:text-fg disabled:opacity-50';
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-md border border-border px-1">
          <button disabled={pending || !signedIn} aria-label="Upvote" onClick={() => run(() => vote(post.id, post.my_vote === 1 ? 0 : 1, path))}
            className={`px-1 text-sm ${post.my_vote === 1 ? 'text-accent' : 'text-muted hover:text-fg'}`}>▲</button>
          <span className="min-w-4 text-center text-xs tabular-nums">{post.score}</span>
          <button disabled={pending || !signedIn} aria-label="Downvote" onClick={() => run(() => vote(post.id, post.my_vote === -1 ? 0 : -1, path))}
            className={`px-1 text-sm ${post.my_vote === -1 ? 'text-accent' : 'text-muted hover:text-fg'}`}>▼</button>
        </div>
        {signedIn && replyForm}
        {canEdit && <button className={btn} onClick={() => setEditing(e => !e)}>Edit</button>}
        {canEdit && <button className={btn} disabled={pending} onClick={() => confirm('Delete this post?') && run(() => deletePost(post.id, path))}>Delete</button>}
        {signedIn && !canEdit && <button className={btn} disabled={pending} onClick={() => { const r = prompt('What is wrong with this post?'); if (r !== null) run(() => reportPost(post.id, r), 'Reported, thanks.'); }}>Report</button>}
        {canModerate && <button className={btn} disabled={pending} onClick={() => run(() => setHidden(post.id, !post.hidden, path))}>{post.hidden ? 'Unhide' : 'Hide'}</button>}
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
      {editing && (
        <form action={editAction} className="space-y-2">
          <input type="hidden" name="id" value={post.id} />
          <input type="hidden" name="path" value={path} />
          <textarea name="body_md" defaultValue={post.body_md} rows={6} className="mono w-full rounded-md border border-border bg-bg p-2 text-sm" />
          <div className="flex items-center gap-3">
            <button disabled={saving} className="rounded-md bg-accent px-3 py-1 text-sm text-accent-fg">Save</button>
            {state.error && <span className="text-xs text-accent">{state.error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}

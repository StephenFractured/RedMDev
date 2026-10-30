'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { createPost, type ActionState } from '@/app/actions';

export default function PostForm({ target, path, kind, parentId, compact }: {
  target: { type: string; id: string }; path: string; kind: 'comment' | 'example'; parentId?: number; compact?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createPost, {});
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(!compact && kind === 'comment');
  useEffect(() => { if (state.ok) { form.current?.reset(); if (compact || kind === 'example') setOpen(false); } }, [state, compact, kind]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className={compact ? 'text-xs text-muted hover:text-fg' : 'rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted hover:border-accent hover:text-fg'}>
        {compact ? 'Reply' : kind === 'example' ? '+ Add an example' : '+ Comment'}
      </button>
    );
  }
  return (
    <form ref={form} action={action} className="space-y-2 rounded-lg border border-border bg-panel p-3">
      <input type="hidden" name="target_type" value={target.type} />
      <input type="hidden" name="target_id" value={target.id} />
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="kind" value={kind} />
      {parentId && <input type="hidden" name="parent_id" value={parentId} />}
      {kind === 'example' && (
        <div className="flex gap-2">
          <input name="title" placeholder="What does it do? (optional)" maxLength={140}
            className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-accent" />
          <select name="lang" defaultValue="lua" className="rounded-md border border-border bg-bg px-2 text-sm">
            <option value="lua">Lua</option><option value="js">JS</option><option value="cs">C#</option>
          </select>
        </div>
      )}
      <textarea name="body_md" required rows={kind === 'example' ? 8 : compact ? 3 : 4}
        placeholder={kind === 'example' ? 'Paste working code. It is shown as a code block in the language you picked.' : 'Markdown supported. Use ```lua for code.'}
        className={`w-full rounded-md border border-border bg-bg px-2.5 py-2 text-sm outline-none focus:border-accent ${kind === 'example' ? 'mono' : ''}`} />
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-50">
          {pending ? 'Posting…' : kind === 'example' ? 'Post example' : parentId ? 'Reply' : 'Comment'}
        </button>
        {(compact || kind === 'example') && <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted">Cancel</button>}
        {state.error && <span className="text-sm text-accent">{state.error}</span>}
      </div>
    </form>
  );
}

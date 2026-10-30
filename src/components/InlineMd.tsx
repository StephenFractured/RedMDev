import { Fragment, type ReactNode } from 'react';

const safeUrl = (u: string) => /^https?:\/\//i.test(u) ? u : null;

/** Tiny inline-markdown renderer for table cells: images, links, **bold**, `code`. No raw HTML. */
export function inlineMd(src: string): ReactNode {
  const out: ReactNode[] = [];
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]*)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  const text = src.replace(/<[^>]+>/g, ' ');
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      const u = safeUrl(m[2]);
      // eslint-disable-next-line @next/next/no-img-element
      out.push(u ? <img key={k++} src={u} alt={m[1]} loading="lazy" className="inline-block max-h-16 max-w-[96px] rounded bg-[repeating-conic-gradient(#8882_0_25%,transparent_0_50%)] bg-[length:12px_12px] align-middle" /> : m[1]);
    } else if (m[4] !== undefined) {
      const u = safeUrl(m[4]);
      out.push(u ? <a key={k++} href={u} target="_blank" rel="nofollow noopener" className="text-accent underline">{m[3]}</a> : m[3]);
    } else if (m[5] !== undefined) out.push(<strong key={k++}>{m[5]}</strong>);
    else if (m[6] !== undefined) out.push(<code key={k++} className="mono">{m[6]}</code>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return <Fragment>{out}</Fragment>;
}

/** Plain text of a cell, for copying. */
export const plain = (s: string) =>
  s.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*|`/g, '').replace(/<[^>]+>/g, ' ').trim();

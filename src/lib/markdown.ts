import 'server-only';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js/lib/common';
import sanitizeHtml from 'sanitize-html';

const md = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const l = lang === 'cs' ? 'csharp' : lang === 'js' ? 'javascript' : lang;
      return l && hljs.getLanguage(l) ? hljs.highlight(code, { language: l }).value : hljs.highlightAuto(code, ['lua', 'javascript', 'csharp', 'json']).value;
    },
  }),
  { gfm: true, breaks: false },
);

const allowed: sanitizeHtml.IOptions = {
  allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'h1', 'h2', 'span', 'details', 'summary', 'del'],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel', 'id'], img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    span: ['class'], code: ['class'], pre: ['class'], th: ['align'], td: ['align'], h2: ['id'], h3: ['id'], h4: ['id'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener', target: '_blank' }),
    img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }),
  },
};

/** Markdown from users or upstream files → safe HTML with highlighted code. */
export function renderMarkdown(src: string): string {
  return sanitizeHtml(md.parse(src, { async: false }) as string, allowed);
}

export function renderInline(src: string): string {
  return sanitizeHtml(md.parseInline(src, { async: false }) as string, allowed);
}

export function highlight(code: string, lang: string): string {
  return hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : sanitizeHtml(code, { allowedTags: [] });
}

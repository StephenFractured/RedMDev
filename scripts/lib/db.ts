import { readFileSync } from 'node:fs';
import postgres from 'postgres';

// Pick up DATABASE_URL from .env.local / .env like `next dev` does. Parsed by hand so it works
// on any Node version and with files saved as UTF-16 (PowerShell's `>` does that).
for (const f of ['.env.local', '.env']) {
  let text: string;
  try {
    const buf = readFileSync(f);
    text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8');
  } catch { continue; }
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

if (!process.env.DATABASE_URL) console.warn('DATABASE_URL is not set (no .env.local found here); using local Postgres.');
const url = process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/redmdev';
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
export const sql = postgres(url, { max: 4, onnotice: () => {}, ssl: local ? false : 'require' });

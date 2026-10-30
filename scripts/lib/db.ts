import postgres from 'postgres';

// Pick up DATABASE_URL from .env.local / .env like `next dev` does.
for (const f of ['.env.local', '.env']) {
  try { process.loadEnvFile(f); } catch { /* file not present */ }
}

const url = process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/redmdev';
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
export const sql = postgres(url, { max: 4, onnotice: () => {}, ssl: local ? false : 'require' });

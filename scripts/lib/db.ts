import postgres from 'postgres';
export const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/redref', {
  max: 4, onnotice: () => {},
});

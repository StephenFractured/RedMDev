import postgres from 'postgres';
export const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/redmdev', {
  max: 4, onnotice: () => {},
});

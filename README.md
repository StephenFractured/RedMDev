# RedRef

A reference site for RedM developers: every RDR3 native plus the whole
[rdr3_discoveries](https://github.com/femga/rdr3_discoveries) dictionary, with one search box,
cross-links between them, and community examples and comments.

- **Natives**: 7,132 natives from [VORPCORE/RDR3natives](https://github.com/VORPCORE/RDR3natives)
  (alloc8or's DB plus community descriptions), browsable by namespace, with Lua / JS / C# call snippets.
- **Discoveries**: every folder of rdr3_discoveries as a page. README prose and examples are kept;
  every table and Lua data file becomes a filterable, paged table (about 210k rows).
- **Search** (`Ctrl K` or `/` anywhere): names, 64-bit native hashes, and 32-bit hashes in hex,
  signed or unsigned form. Shows `joaat()` of what you typed.
- **Community**: examples (Lua/JS/C#) and comments on every native and discovery page, with votes,
  replies, edit history, reports, and moderator hide.
- **Hash tool**: joaat calculator and hex / signed / unsigned converter.

## Stack

Next.js 15 (App Router) · Postgres (Supabase in production) · Supabase Auth for Discord/GitHub login · Tailwind 4.
The app queries Postgres directly from the server with [`postgres`](https://github.com/porsager/postgres);
search uses `pg_trgm` indexes.

## Run locally

```bash
npm install
cp .env.example .env.local          # point DATABASE_URL at any Postgres 15+
npm run db:schema
npm run ingest:natives              # downloads the native DBs (cached in .data/)
npm run ingest:discoveries -- /path/to/rdr3_discoveries
npm run dev
```

Without Supabase settings the site runs with a development login (any name, no password).
It is disabled automatically in production builds.

## Deploy (Supabase + Vercel)

1. Create a Supabase project. In the SQL editor, run `db/schema.sql`.
2. Run the two ingest commands locally with `DATABASE_URL` set to the Supabase connection string.
3. Supabase → Authentication → Providers: enable **Discord** (create an app at
   discord.com/developers, redirect URL = the callback URL Supabase shows) and optionally **GitHub**.
   Add `https://<your-domain>/auth/callback` to Authentication → URL Configuration → Redirect URLs.
4. Import the repo in Vercel and set `DATABASE_URL` (transaction pooler URI),
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_URL`.
5. To make someone a moderator: `update profiles set role = 'mod' where username = '…';`

## Updating the data

Re-run `npm run ingest` with a fresh checkout of rdr3_discoveries. Natives are upserted by hash,
discovery tables are replaced. Community posts are stored separately and are never touched; posts on
discovery pages are keyed by folder path, so they survive re-imports.

## How the discoveries import works

`scripts/ingest-discoveries.ts` walks the repo. Each folder becomes a category.

- **Markdown**: tables become datasets; the rest of the README stays as the page intro, with
  each table shown where it was. Runs of small same-shaped tables (Controls) are merged with a
  `section` column.
- **Lua**: parsed with `luaparse` (backtick hashes and Lua 5.4 `<const>` are tolerated; rows with a
  missing comma are repaired or skipped). Top-level tables become rows; trailing comments (usually
  the hash in hex/decimal) become a `note` column; `{name, name, …}` format comments name the
  columns; `key → list` tables (anim dictionaries, audio banks) become expandable groups.
  Files with no data table are shown as highlighted code.
- **Cross-links**: native hashes and native names (PascalCase or UPPER_CASE) found in a folder link
  that folder and the native both ways.

Column-name overrides for files whose layout isn't self-describing live in `HINTS` at the top of the script.

## Credits

Natives: VORPCORE/RDR3natives, alloc8or's rdr3-nativedb-data. Discoveries: femga and the
rdr3_discoveries contributors. Texture previews are loaded from femga.com.

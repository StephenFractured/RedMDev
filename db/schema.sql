-- RedMDev schema. Runs on Supabase (Postgres 15+) or plain Postgres.
create extension if not exists pg_trgm;

-- ---------- Natives ----------
create table if not exists natives (
  hash         text primary key,            -- '0xD49F9B0955C367DE'
  name         text not null,               -- 'CREATE_PED' or '_0x...'
  namespace    text not null,
  params       jsonb not null default '[]',
  return_type  text not null default 'void',
  comment      text not null default '',
  build        text,
  examples     jsonb not null default '[]',   -- seeded examples from the VORP native docs
  apiset       text not null default '',
  is_named     boolean generated always as (name not like '\_0x%') stored,
  search_text  text not null default '',
  updated_at   timestamptz not null default now()
);
create index if not exists natives_ns_idx on natives (namespace, name);
create index if not exists natives_search_trgm on natives using gin (search_text gin_trgm_ops);

-- ---------- Discoveries ----------
-- A category is a folder of the rdr3_discoveries repo.
create table if not exists categories (
  path        text primary key,               -- 'AI/CPED_CONFIG_FLAGS'
  parent_path text references categories(path) on delete cascade,
  title       text not null,
  intro_md    text not null default '',        -- README prose and examples, tables removed
  sort        int  not null default 0
);

-- A dataset is one table from a README, one Lua data file, or one code file.
create table if not exists datasets (
  id            text primary key,              -- 'AI/CPED_CONFIG_FLAGS#0'
  category_path text not null references categories(path) on delete cascade,
  title         text not null,
  kind          text not null check (kind in ('table','list','code')),
  source_file   text not null,
  columns       jsonb not null default '[]',   -- ordered column names
  notes_md      text not null default '',      -- header comment / text preceding the table
  code          text,                          -- for kind = 'code'
  row_count     int  not null default 0,
  sort          int  not null default 0
);
create index if not exists datasets_cat_idx on datasets (category_path, sort);

create table if not exists entries (
  id          bigserial primary key,
  dataset_id  text not null references datasets(id) on delete cascade,
  ord         int  not null,
  cells       jsonb not null,                  -- {column: value}
  items       jsonb,                           -- grouped lists (anim dict -> names)
  search_text text not null
);
create index if not exists entries_ds_idx on entries (dataset_id, ord);
create index if not exists entries_search_trgm on entries using gin (search_text gin_trgm_ops);

-- Native hashes mentioned by discoveries content.
create table if not exists native_refs (
  native_hash   text not null,
  category_path text not null references categories(path) on delete cascade,
  dataset_id    text references datasets(id) on delete cascade,
  primary key (native_hash, category_path)
);
create index if not exists native_refs_cat_idx on native_refs (category_path);

-- ---------- Community ----------
create table if not exists profiles (
  id         uuid primary key,                 -- auth.users.id on Supabase
  username   text not null,
  avatar_url text,
  role       text not null default 'member' check (role in ('member','mod','admin')),
  created_at timestamptz not null default now()
);

-- target_type/target_id: ('native', '0xHASH') | ('category', 'AI/CPED_CONFIG_FLAGS')
create table if not exists posts (
  id          bigserial primary key,
  target_type text not null check (target_type in ('native','category')),
  target_id   text not null,
  kind        text not null check (kind in ('comment','example')),
  parent_id   bigint references posts(id) on delete cascade,
  author_id   uuid not null references profiles(id) on delete cascade,
  title       text,
  lang        text,                            -- examples: lua | js | cs
  body_md     text not null check (length(body_md) between 1 and 20000),
  score       int  not null default 0,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  edited_at   timestamptz
);
create index if not exists posts_target_idx on posts (target_type, target_id, created_at);
create index if not exists posts_recent_idx on posts (created_at desc);

create table if not exists post_revisions (
  id         bigserial primary key,
  post_id    bigint not null references posts(id) on delete cascade,
  body_md    text not null,
  created_at timestamptz not null default now()
);

create table if not exists votes (
  post_id bigint not null references posts(id) on delete cascade,
  user_id uuid   not null references profiles(id) on delete cascade,
  value   smallint not null check (value in (-1, 1)),
  primary key (post_id, user_id)
);

create table if not exists reports (
  id         bigserial primary key,
  post_id    bigint not null references posts(id) on delete cascade,
  user_id    uuid   not null references profiles(id) on delete cascade,
  reason     text not null default '',
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

-- The app talks to Postgres directly (server-side), never through Supabase's REST API.
-- Turning on RLS with no policies closes the auto-generated REST endpoints to the anon key.
alter table natives        enable row level security;
alter table categories     enable row level security;
alter table datasets       enable row level security;
alter table entries        enable row level security;
alter table native_refs    enable row level security;
alter table profiles       enable row level security;
alter table posts          enable row level security;
alter table post_revisions enable row level security;
alter table votes          enable row level security;
alter table reports        enable row level security;

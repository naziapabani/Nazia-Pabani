-- Hard Enough — shared board schema.
-- Paste this whole file into the Supabase SQL editor and hit Run.
--
-- Design note: check-ins are ROWS, not a JSON blob. Two people ticking a box
-- at the same moment touch different rows, so there is no conflict to resolve
-- and no last-write-wins clobbering -- which is exactly what went wrong with
-- the artifact approach.

create table if not exists boards (
  id          text primary key,          -- random slug; the link is the key
  challenge   jsonb not null,            -- name, days, tasks, rest days, target
  updated_at  timestamptz not null default now()
);

create table if not exists members (
  id          text primary key,
  board_id    text not null references boards(id) on delete cascade,
  name        text not null,
  color       text,
  plan        text not null default '',
  start_date  date not null,             -- everyone counts from their own day 1
  created_at  timestamptz not null default now()
);
create index if not exists members_board on members(board_id);

create table if not exists checkins (
  member_id   text not null references members(id) on delete cascade,
  day         date not null,
  task_ids    text[] not null default '{}',
  primary key (member_id, day)
);

create table if not exists rest_days (
  member_id   text not null references members(id) on delete cascade,
  day         date not null,
  primary key (member_id, day)
);

create table if not exists workouts (
  id          text primary key,
  member_id   text not null references members(id) on delete cascade,
  day         date not null,
  type        text not null default 'Other',
  min         int  not null default 0,
  kcal        int  not null default 0,
  hr          int  not null default 0
);
create index if not exists workouts_member_day on workouts(member_id, day);

-- Anyone holding the board link can read and write it, the same way a shared
-- document works. The board id is a long random slug, so the link IS the
-- credential -- do not post it publicly.
alter table boards    enable row level security;
alter table members   enable row level security;
alter table checkins  enable row level security;
alter table rest_days enable row level security;
alter table workouts  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['boards','members','checkins','rest_days','workouts'] loop
    execute format('drop policy if exists open_access on %I', t);
    execute format(
      'create policy open_access on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Push changes to every open device in real time.
alter publication supabase_realtime add table boards;
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table checkins;
alter publication supabase_realtime add table rest_days;
alter publication supabase_realtime add table workouts;

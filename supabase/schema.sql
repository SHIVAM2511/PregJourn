-- Nestling: shared family space for two (or more) people.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run.

-- ---------- tables ----------
create table if not exists public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'Our family',
  invite_code  text not null unique,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text,
  joined_at     timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists household_members_user_idx on public.household_members(user_id);

-- One row per app section (profile, meds, health, …). `version` gives optimistic
-- concurrency: a write only succeeds if it is based on the latest version.
create table if not exists public.nest_docs (
  household_id  uuid not null references public.households(id) on delete cascade,
  key           text not null check (char_length(key) <= 40),
  data          jsonb not null,
  version       integer not null default 1,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null,
  primary key (household_id, key)
);

-- ---------- helpers ----------
create or replace function public.is_household_member(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members where household_id = hid and user_id = auth.uid());
$$;

create or replace function public.nest_docs_stamp()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists nest_docs_stamp on public.nest_docs;
create trigger nest_docs_stamp before insert or update on public.nest_docs
  for each row execute function public.nest_docs_stamp();

-- ---------- row level security ----------
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.nest_docs enable row level security;

drop policy if exists "members read household" on public.households;
create policy "members read household" on public.households
  for select to authenticated using (public.is_household_member(id));

drop policy if exists "members read members" on public.household_members;
create policy "members read members" on public.household_members
  for select to authenticated using (public.is_household_member(household_id));

drop policy if exists "update own member row" on public.household_members;
create policy "update own member row" on public.household_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "leave household" on public.household_members;
create policy "leave household" on public.household_members
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "members read docs" on public.nest_docs;
create policy "members read docs" on public.nest_docs
  for select to authenticated using (public.is_household_member(household_id));

drop policy if exists "members insert docs" on public.nest_docs;
create policy "members insert docs" on public.nest_docs
  for insert to authenticated with check (public.is_household_member(household_id));

drop policy if exists "members update docs" on public.nest_docs;
create policy "members update docs" on public.nest_docs
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "members delete docs" on public.nest_docs;
create policy "members delete docs" on public.nest_docs
  for delete to authenticated using (public.is_household_member(household_id));

revoke all on public.households, public.household_members, public.nest_docs from anon;
grant select on public.households to authenticated;
grant select, update (display_name), delete on public.household_members to authenticated;
grant select, insert, update, delete on public.nest_docs to authenticated;

-- ---------- create / join (invite code) ----------
-- Codes look like ABCD-EF23 (no 0/O/1/I/L), from a cryptographic random source.
create or replace function public.nest_new_code()
returns text language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := gen_random_bytes(8);
  code text := '';
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
  end loop;
  return code;
end $$;

create or replace function public.create_household(p_name text default 'Our family', p_display_name text default null)
returns public.households language plpgsql security definer set search_path = public, extensions as $$
declare
  h public.households;
  c text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  loop
    c := public.nest_new_code();
    exit when not exists (select 1 from public.households where invite_code = c);
  end loop;
  insert into public.households (name, invite_code, created_by)
    values (coalesce(nullif(trim(p_name), ''), 'Our family'), c, auth.uid()) returning * into h;
  insert into public.household_members (household_id, user_id, display_name)
    values (h.id, auth.uid(), nullif(trim(p_display_name), ''));
  return h;
end $$;

create or replace function public.join_household(p_code text, p_display_name text default null)
returns public.households language plpgsql security definer set search_path = public as $$
declare
  h public.households;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into h from public.households
    where invite_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if h.id is null then raise exception 'That code did not match any family space'; end if;
  insert into public.household_members (household_id, user_id, display_name)
    values (h.id, auth.uid(), nullif(trim(p_display_name), ''))
    on conflict (household_id, user_id) do update set display_name = coalesce(excluded.display_name, household_members.display_name);
  return h;
end $$;

revoke execute on function public.create_household(text, text), public.join_household(text, text), public.nest_new_code() from public, anon;
grant execute on function public.create_household(text, text), public.join_household(text, text) to authenticated;

-- ---------- realtime (live updates between phones) ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'nest_docs') then
    alter publication supabase_realtime add table public.nest_docs;
  end if;
end $$;

-- Lyric Book: accounts + song sync on Supabase.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- Safe to run again (it replaces what it created).

-- ---------- Profiles: username + email for each account ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_.]{3,24}$'),
  email text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_username_key on public.profiles (lower(username));
alter table public.profiles enable row level security;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (id = auth.uid());

-- A new account gets a profile. The very first account is the admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, email, is_admin)
  values (new.id, new.raw_user_meta_data->>'username', new.email, not exists (select 1 from public.profiles));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Songs: each account only ever sees its own ----------
create table if not exists public.projects (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null default '',
  body text not null default '',
  study boolean not null default false,
  deleted boolean not null default false,   -- deletes sync too, so a song deleted on one device goes everywhere
  updated bigint not null,                  -- when it was last edited (app clock, ms); newest edit wins
  modified_at timestamptz not null default now(),  -- when the server got it; devices fetch what changed since last time
  primary key (user_id, id)
);
create index if not exists projects_modified on public.projects (user_id, modified_at);
alter table public.projects enable row level security;
drop policy if exists "own songs" on public.projects;
create policy "own songs" on public.projects for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;
revoke all on public.profiles, public.admin_recovery from anon;
grant select on public.profiles to authenticated;

create or replace function public.touch_project() returns trigger language plpgsql as $$
begin new.modified_at := clock_timestamp(); return new; end $$;
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before insert or update on public.projects
  for each row execute function public.touch_project();

-- ---------- Sign-in helpers (usable before signing in) ----------
-- Sign in with a username: look up the email it belongs to.
create or replace function public.email_for_username(p_username text) returns text
language sql security definer set search_path = public stable as $$
  select email from public.profiles where lower(username) = lower(p_username);
$$;
create or replace function public.username_available(p_username text) returns boolean
language sql security definer set search_path = public stable as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(p_username));
$$;

-- ---------- Admin ----------
create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.admin_list_users()
returns table (username text, email text, is_admin boolean, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query select p.username, p.email, p.is_admin, p.created_at, u.last_sign_in_at
    from public.profiles p join auth.users u on u.id = p.id order by p.created_at;
end $$;

-- Sets the password for an account by username (also confirms its email, so it can sign in straight away).
create or replace function public._set_password(p_username text, p_password text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if length(coalesce(p_password, '')) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  select id into uid from public.profiles where lower(username) = lower(p_username);
  if uid is null then raise exception 'No account with that username'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
  where id = uid;
end $$;
revoke all on function public._set_password(text, text) from public, anon, authenticated;

create or replace function public.admin_set_password(p_username text, p_password text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  perform public._set_password(p_username, p_password);
end $$;

-- Admin recovery code: lets the admin set a new password while signed out, with no email needed.
create table if not exists public.admin_recovery (
  id int primary key default 1 check (id = 1),
  code_hash text not null
);
alter table public.admin_recovery enable row level security;  -- no policies: only the functions below can read it

create or replace function public.admin_set_recovery_code(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if length(coalesce(p_code, '')) < 12 then raise exception 'Recovery code too short'; end if;
  insert into public.admin_recovery (id, code_hash) values (1, extensions.crypt(p_code, extensions.gen_salt('bf')))
  on conflict (id) do update set code_hash = excluded.code_hash;
end $$;

create or replace function public.admin_recover(p_username text, p_code text, p_password text) returns void
language plpgsql security definer set search_path = public as $$
declare h text;
begin
  perform pg_sleep(1);  -- slows down guessing
  select code_hash into h from public.admin_recovery where id = 1;
  if h is null or extensions.crypt(coalesce(p_code, ''), h) <> h
     or not exists (select 1 from public.profiles where lower(username) = lower(p_username) and is_admin) then
    raise exception 'Recovery code or username is wrong';
  end if;
  perform public._set_password(p_username, p_password);
end $$;

-- Who can call what
revoke all on function public.admin_list_users(), public.admin_set_password(text, text),
  public.admin_set_recovery_code(text) from public, anon;
grant execute on function public.admin_list_users(), public.admin_set_password(text, text),
  public.admin_set_recovery_code(text), public.is_admin() to authenticated;
grant execute on function public.email_for_username(text), public.username_available(text),
  public.admin_recover(text, text, text) to anon, authenticated;

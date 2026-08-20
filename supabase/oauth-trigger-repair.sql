-- Repair a profile trigger that can block Google OAuth with an HTTP 500.
-- Safe to run more than once in Supabase Dashboard > SQL Editor.

alter table public.profiles add column if not exists first_name text not null default '';
alter table public.profiles add column if not exists last_name text not null default '';
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists role text not null default 'student';
alter table public.profiles add column if not exists email_verified boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '');
begin
  insert into public.profiles (
    id, first_name, last_name, email, phone, role, email_verified
  ) values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'first_name', ''), nullif(split_part(display_name, ' ', 1), ''), 'Student'),
    coalesce(nullif(new.raw_user_meta_data ->> 'last_name', ''), nullif(trim(substr(display_name, length(split_part(display_name, ' ', 1)) + 1)), ''), ''),
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    'student',
    new.email_confirmed_at is not null
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profiles.phone),
    email_verified = excluded.email_verified;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert or update of email_confirmed_at on auth.users
for each row execute function public.handle_new_user();

-- Backfill anyone created during an earlier failed or partial setup.
insert into public.profiles (id, first_name, last_name, email, phone, role, email_verified)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'first_name', ''), nullif(split_part(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), ' ', 1), ''), 'Student'),
  coalesce(nullif(u.raw_user_meta_data ->> 'last_name', ''), ''),
  coalesce(u.email, ''),
  nullif(u.raw_user_meta_data ->> 'phone', ''),
  'student',
  u.email_confirmed_at is not null
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  email_verified = excluded.email_verified;

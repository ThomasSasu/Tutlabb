-- Run once in Supabase Dashboard > SQL Editor.
-- Adds secure tutor-application submissions and private evidence storage.

alter table public.tutor_applications alter column gpa drop not null;
alter table public.tutor_applications add column if not exists review_stage text not null default 'initial_screening';
alter table public.tutor_applications add column if not exists reviewer_id uuid references public.profiles(id) on delete set null;
alter table public.tutor_applications add column if not exists reviewer_notes text;
alter table public.tutor_applications add column if not exists decision_reason text;
alter table public.tutor_applications add column if not exists reviewed_at timestamptz;

create or replace function public.is_tutor_reviewer()
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'sasuthomasansong@gmail.com';
$$;

drop policy if exists "submit own application" on public.tutor_applications;
create policy "submit own application"
on public.tutor_applications for insert
to authenticated
with check (auth.uid() = user_id and status = 'submitted');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tutor-verification',
  'tutor-verification',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "upload own tutor evidence" on storage.objects;
create policy "upload own tutor evidence"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'tutor-verification'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "read own tutor evidence" on storage.objects;
create policy "read own tutor evidence"
on storage.objects for select
to authenticated
using (
  bucket_id = 'tutor-verification'
  and (storage.foldername(name))[1] = auth.uid()::text
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tutor-photos', 'tutor-photos', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "upload own tutor photo" on storage.objects;
create policy "upload own tutor photo" on storage.objects for insert to authenticated
with check (bucket_id='tutor-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "public tutor photos" on storage.objects;
create policy "public tutor photos" on storage.objects for select using (bucket_id='tutor-photos');
drop policy if exists "reviewer reads evidence" on storage.objects;
create policy "reviewer reads evidence" on storage.objects for select to authenticated
using (bucket_id='tutor-verification' and public.is_tutor_reviewer());

drop policy if exists "reviewer reads applications" on public.tutor_applications;
create policy "reviewer reads applications" on public.tutor_applications for select to authenticated using (public.is_tutor_reviewer());
drop policy if exists "reviewer updates applications" on public.tutor_applications;
create policy "reviewer updates applications" on public.tutor_applications for update to authenticated using (public.is_tutor_reviewer()) with check (public.is_tutor_reviewer());
drop policy if exists "reviewer creates tutors" on public.tutors;
create policy "reviewer creates tutors" on public.tutors for insert to authenticated with check (public.is_tutor_reviewer());
drop policy if exists "reviewer updates tutors" on public.tutors;
create policy "reviewer updates tutors" on public.tutors for update to authenticated using (public.is_tutor_reviewer()) with check (public.is_tutor_reviewer());

update public.profiles set role='admin' where lower(email)='sasuthomasansong@gmail.com';

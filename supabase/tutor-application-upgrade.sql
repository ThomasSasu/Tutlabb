-- Run once in Supabase Dashboard > SQL Editor.
-- Adds secure tutor-application submissions and private evidence storage.

alter table public.tutor_applications alter column gpa drop not null;

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

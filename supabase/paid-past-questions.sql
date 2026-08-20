-- Run in Supabase Dashboard > SQL Editor before publishing paid past questions.
-- Approved tutors can publish; buyers receive time-limited question-file links after payment.

create table if not exists public.paid_resources (
  id uuid primary key default gen_random_uuid(),
  tutor_id text not null references public.tutors(id) on delete cascade,
  title text not null,
  course text not null,
  institution text,
  exam_year text,
  description text not null,
  price numeric(10,2) not null check (price >= 1 and price <= 500),
  currency text not null default 'GHS',
  status text not null default 'published' check (status in ('published','hidden','removed')),
  rights_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.paid_resource_assets (
  resource_id uuid primary key references public.paid_resources(id) on delete cascade,
  question_path text not null,
  video_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.resource_purchases (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.paid_resources(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null,
  amount_subunit bigint not null,
  currency text not null default 'GHS',
  payment_reference text not null unique,
  payment_status text not null default 'pending',
  paystack_status text,
  payment_channel text,
  gateway_response text,
  creator_payout numeric(10,2) not null,
  platform_share numeric(10,2) not null,
  payout_status text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_paid_resource_purchase_per_buyer
on public.resource_purchases (buyer_id, resource_id)
where payment_status = 'paid';

alter table public.paid_resources enable row level security;
alter table public.paid_resource_assets enable row level security;
alter table public.resource_purchases enable row level security;

drop policy if exists "published paid resources" on public.paid_resources;
create policy "published paid resources" on public.paid_resources for select
using (status = 'published');

drop policy if exists "approved tutors publish resources" on public.paid_resources;
create policy "approved tutors publish resources" on public.paid_resources for insert to authenticated
with check (
  rights_confirmed = true and status = 'published' and
  exists (select 1 from public.tutors where id = tutor_id and user_id = auth.uid() and published = true)
);

drop policy if exists "tutors read own resource assets" on public.paid_resource_assets;
create policy "tutors read own resource assets" on public.paid_resource_assets for select to authenticated
using (
  exists (
    select 1 from public.paid_resources r
    join public.tutors t on t.id = r.tutor_id
    where r.id = resource_id and t.user_id = auth.uid()
  )
);

drop policy if exists "buyers read own purchases" on public.resource_purchases;
create policy "buyers read own purchases" on public.resource_purchases for select to authenticated
using (buyer_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'past-questions',
  'past-questions',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "approved tutors upload past questions" on storage.objects;
create policy "approved tutors upload past questions" on storage.objects for insert to authenticated
with check (
  bucket_id = 'past-questions'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.tutors where user_id = auth.uid() and published = true)
);

drop policy if exists "tutors remove own past question uploads" on storage.objects;
create policy "tutors remove own past question uploads" on storage.objects for delete to authenticated
using (bucket_id = 'past-questions' and (storage.foldername(name))[1] = auth.uid()::text);

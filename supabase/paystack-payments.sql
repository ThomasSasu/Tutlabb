-- Run in Supabase Dashboard > SQL Editor before testing Paystack checkout.
-- Safe to run again: existing columns, indexes, and policies are preserved or replaced.

alter table public.bookings add column if not exists tutor_id text references public.tutors(id) on delete set null;
alter table public.bookings add column if not exists currency text not null default 'GHS';
alter table public.bookings add column if not exists amount_subunit bigint;
alter table public.bookings add column if not exists scheduled_at timestamptz;
alter table public.bookings add column if not exists paystack_status text;
alter table public.bookings add column if not exists payment_channel text;
alter table public.bookings add column if not exists gateway_response text;
alter table public.bookings add column if not exists paid_at timestamptz;
alter table public.bookings add column if not exists updated_at timestamptz not null default now();

create unique index if not exists bookings_payment_reference_key
on public.bookings (payment_reference)
where payment_reference is not null;

alter table public.bookings enable row level security;

drop policy if exists "own bookings" on public.bookings;
create policy "own bookings"
on public.bookings for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "tutor reads assigned bookings" on public.bookings;
create policy "tutor reads assigned bookings"
on public.bookings for select
to authenticated
using (
  exists (
    select 1 from public.tutors
    where public.tutors.id = public.bookings.tutor_id
      and public.tutors.user_id = auth.uid()
  )
);

drop policy if exists "reviewer reads all bookings" on public.bookings;
create policy "reviewer reads all bookings"
on public.bookings for select
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'ansongsx@gmail.com');

-- Выполните этот скрипт в Supabase: SQL Editor → New query → Run.
create table if not exists public.family_lists (
  room_id uuid primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.family_lists enable row level security;

create policy "family members read their room"
on public.family_lists for select to anon
using (room_id::text = coalesce(current_setting('request.headers', true)::json ->> 'x-family-room', ''));

create policy "family members create their room"
on public.family_lists for insert to anon
with check (room_id::text = coalesce(current_setting('request.headers', true)::json ->> 'x-family-room', ''));

create policy "family members update their room"
on public.family_lists for update to anon
using (room_id::text = coalesce(current_setting('request.headers', true)::json ->> 'x-family-room', ''))
with check (room_id::text = coalesce(current_setting('request.headers', true)::json ->> 'x-family-room', ''));

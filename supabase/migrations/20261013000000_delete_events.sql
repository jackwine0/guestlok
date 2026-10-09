-- Guestlok — hosts can delete any of their events (draft, upcoming or past)
-- Run this AFTER 20261012000000_shared_sending.sql (SQL Editor → paste → Run).
--
-- Deleting an event removes its guests, gate requests and sender links (cascade).
-- Payment records are KEPT for your accounts: their event link is cleared and the
-- event name is copied onto the payment first.

-- Keep payments when their event is deleted.
alter table public.payments add column if not exists event_name text;
alter table public.payments alter column event_id drop not null;
alter table public.payments drop constraint if exists payments_event_id_fkey;
alter table public.payments
  add constraint payments_event_id_fkey foreign key (event_id) references public.events (id) on delete set null;

-- Copy the event name onto its payments just before the event goes.
create or replace function public.gl_events_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payments set event_name = old.name where event_id = old.id and event_name is null;
  return old;
end;
$$;
drop trigger if exists events_before_delete on public.events;
create trigger events_before_delete before delete on public.events
for each row execute function public.gl_events_before_delete();

-- Hosts may delete their own events whatever the status (was: drafts only).
drop policy if exists "owners delete drafts" on public.events;
drop policy if exists "owners delete events" on public.events;
create policy "owners delete events" on public.events for delete using (owner_id = auth.uid());

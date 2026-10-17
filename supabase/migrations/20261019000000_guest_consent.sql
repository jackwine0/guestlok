-- Guestlok — hosts confirm they may share their guests' contacts (Nigeria Data Protection Act)
-- Run this AFTER 20261018000000_event_summaries.sql (SQL Editor → paste → Run).
--
-- The first time a host adds or imports guests for an event, the app asks them to confirm
-- they have permission to share these people's names and numbers with Guestlok for the
-- event. When they agree, the time is saved here, so you have a record and they're only
-- asked once per event.

alter table public.events add column if not exists guest_consent_at timestamptz;

-- The My events view lists the events columns, so rebuild it to include the new one.
drop view if exists public.event_summaries;
create view public.event_summaries
with (security_invoker = true) as
select
  e.*,
  coalesce(sum(g.admits), 0)::int as invited,
  coalesce(sum(g.admits) filter (where g.checked_in_at is not null), 0)::int as arrived,
  count(g.id)::int as guest_count
from public.events e
left join public.guests g on g.event_id = e.id
group by e.id;

grant select on public.event_summaries to authenticated;

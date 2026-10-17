-- Guestlok — My events loads fast however many events and guests a host has
-- Run this AFTER 20261017000000_account_deletion.sql (SQL Editor → paste → Run).
--
-- The dashboard used to download every guest of every event just to add up the numbers.
-- This view does the adding up in the database: one row per event with its totals.
-- security_invoker = true means the normal row-level security applies, so hosts only
-- ever see their own events.

create or replace view public.event_summaries
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

-- Note: the view copies the events columns as they are now. If you add a column to
-- public.events later, run this file again so the dashboard can see it.

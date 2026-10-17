-- Guest phone numbers are deleted 90 days after an event ends.
--
-- Names, sides, admits and attendance stay, so hosts keep their records.
-- Phone numbers and WhatsApp message ids are cleared, and the app removes the ticket images.
-- "Ends" means when the event was ended, or 24 hours after it started if nobody ended it.
--
-- Runs in two places:
--   1. When a host opens My events: their own events are tidied up, ticket images too.
--   2. Once a day, for every host, if pg_cron is enabled (optional block at the end).

alter table public.events
  add column if not exists phones_cleared_at  timestamptz,
  add column if not exists tickets_cleared_at timestamptz;

-- Hosts can't set or reset these themselves.
create or replace function public.gl_events_retention_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.phones_cleared_at := null;
      new.tickets_cleared_at := null;
    else
      new.phones_cleared_at := old.phones_cleared_at;
      new.tickets_cleared_at := old.tickets_cleared_at;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists events_retention_guard on public.events;
create trigger events_retention_guard before insert or update on public.events
for each row execute function public.gl_events_retention_guard();

-- The moment an event's guest numbers are due to go (null for drafts).
create or replace function public.gl_phones_due(e public.events)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case when e.status = 'draft' then null
    else coalesce(e.ended_at, e.starts_at + interval '24 hours') + interval '90 days' end
$$;

-- Clears numbers for due events. p_owner limits it to one host (null = everyone).
create or replace function public.gl_clear_due_phones(p_owner uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[];
begin
  select coalesce(array_agg(e.id), '{}') into ids
    from public.events e
   where e.phones_cleared_at is null
     and (p_owner is null or e.owner_id = p_owner)
     and public.gl_phones_due(e) <= now();

  if cardinality(ids) = 0 then
    return 0;
  end if;

  update public.guests
     set phone = null, wa_message_id = null, wa_error = null
   where event_id = any(ids)
     and (phone is not null or wa_message_id is not null or wa_error is not null);

  update public.events set phones_cleared_at = now() where id = any(ids);
  return cardinality(ids);
end;
$$;
revoke all on function public.gl_clear_due_phones(uuid) from public, anon, authenticated;

-- For the daily job.
create or replace function public.gl_clear_old_guest_phones()
returns int
language sql
security definer
set search_path = ''
as $$ select public.gl_clear_due_phones(null) $$;
revoke all on function public.gl_clear_old_guest_phones() from public, anon, authenticated;

-- For the signed-in host (My events calls this). Returns the events whose ticket images the
-- app should now remove from storage. Each is returned once.
create or replace function public.clear_my_old_guest_data()
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  perform public.gl_clear_due_phones(auth.uid());
  return query
    update public.events
       set tickets_cleared_at = now()
     where owner_id = auth.uid()
       and phones_cleared_at is not null
       and tickets_cleared_at is null
    returning id;
end;
$$;
revoke all on function public.clear_my_old_guest_data() from public, anon;
grant execute on function public.clear_my_old_guest_data() to authenticated;

-- Keep My events' view in step with the events table's columns.
drop view if exists public.event_summaries;
create view public.event_summaries with (security_invoker = true) as
select e.*,
  coalesce(sum(g.admits), 0)::int as invited,
  coalesce(sum(g.admits) filter (where g.checked_in_at is not null), 0)::int as arrived,
  count(g.id)::int as guest_count
from public.events e
left join public.guests g on g.event_id = e.id
group by e.id;
grant select on public.event_summaries to authenticated;

-- Optional: run daily if pg_cron is enabled
-- (Supabase Dashboard → Database → Extensions → pg_cron). Safe to skip: without it, numbers
-- are still cleared whenever the host next opens My events.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'guestlok-clear-phones';
    perform cron.schedule('guestlok-clear-phones', '17 3 * * *', 'select public.gl_clear_old_guest_phones()');
  else
    raise notice 'pg_cron not enabled: guest numbers are cleared when hosts open My events.';
  end if;
end $$;

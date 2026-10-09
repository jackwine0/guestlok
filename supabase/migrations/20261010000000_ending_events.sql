-- Guestlok — what happens when an event ends
-- Run this AFTER 20261009000000_cover_adjust.sql (SQL Editor → paste → Run).
--
-- 1. Invites of ended events say "This event has ended" instead of showing a QR.
-- 2. Events end automatically 24 hours after their start time.
-- 3. (CSV export is in the app; nothing needed here.)
-- 4. Ended events are frozen in the database, not just in the app.
-- 5. A host can reopen an event they ended by mistake, within 1 hour.

alter table public.events
  add column if not exists ended_at timestamptz,
  add column if not exists ended_by text check (ended_by in ('host', 'auto'));

-- An event counts as over once it has ended, or 24 hours after it started.
create or replace function public.gl_event_over(e public.events)
returns boolean
language sql
stable
set search_path = ''
as $$
  select e.status = 'ended' or e.starts_at < now() - interval '24 hours'
$$;

-- ---------------------------------------------------------------------------
-- Events guard: ended events are read-only for hosts. Ending stamps the time.
-- ---------------------------------------------------------------------------
create or replace function public.gl_events_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.status := 'draft';
      new.headcount := 0;
      new.owner_id := auth.uid();
      new.ended_at := null;
      new.ended_by := null;
    else
      if old.status = 'ended' then
        raise exception 'GL_EVENT_ENDED: This event has ended, so its details are locked.'
          using errcode = 'P0001';
      end if;
      new.status := case
        when old.status = 'active' and new.status = 'ended' then 'ended'  -- host may close an event
        else old.status end;
      if new.status = 'ended' then
        new.ended_at := now();
        new.ended_by := 'host';
      else
        new.ended_at := old.ended_at;
        new.ended_by := old.ended_by;
      end if;
      new.headcount := old.headcount;
      new.owner_id := old.owner_id;
      new.scanner_key := old.scanner_key;
      if old.status <> 'draft' then
        new.tier_id := old.tier_id;  -- tier is locked once paid
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guests are frozen once the event has ended (adds, edits, removals, undo check-in).
-- Named "guests_0_…" so it runs before the capacity check and gives the right message.
-- ---------------------------------------------------------------------------
create or replace function public.gl_guests_frozen()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ev_status text;
begin
  if current_user in ('authenticated', 'anon') then
    select status into ev_status from public.events
     where id = case when tg_op = 'INSERT' then new.event_id else old.event_id end;
    if ev_status = 'ended' then
      raise exception 'GL_EVENT_ENDED: This event has ended, so the guest list is locked.'
        using errcode = 'P0001';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists guests_frozen on public.guests;
drop trigger if exists guests_0_frozen on public.guests;
create trigger guests_0_frozen
before insert or update or delete on public.guests
for each row execute function public.gl_guests_frozen();

-- ---------------------------------------------------------------------------
-- The gate closes 24 hours after the start, even if the host forgot to end it.
-- ---------------------------------------------------------------------------
create or replace function public.gl_scanner_ok(p_event uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events
    where id = p_event and scanner_key = p_key and status = 'active'
      and starts_at > now() - interval '24 hours'
  )
$$;
revoke all on function public.gl_scanner_ok(uuid, text) from public, anon, authenticated;

create or replace function public.scanner_event(p_event uuid, p_key text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'event_name', e.name,
    'starts_at', e.starts_at,
    'venue', e.venue,
    'invited_people', coalesce((select sum(admits) from public.guests where event_id = e.id), 0),
    'arrived_people', coalesce((select sum(admits) from public.guests where event_id = e.id and checked_in_at is not null), 0)
  )
  from public.events e
  where e.id = p_event and e.scanner_key = p_key and e.status = 'active'
    and e.starts_at > now() - interval '24 hours'
$$;

-- Host answering a gate request: only while the event is running.
create or replace function public.gl_decide_request(p_request uuid, p_approve boolean)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.gate_requests;
  ev  public.events;
  g   public.guests;
begin
  select r.* into req from public.gate_requests r where r.id = p_request for update;
  if not found then
    raise exception 'GL_NOT_FOUND: That request no longer exists.' using errcode = 'P0001';
  end if;
  select * into ev from public.events where id = req.event_id;
  if ev.owner_id is distinct from auth.uid() then
    raise exception 'GL_NOT_FOUND: That request no longer exists.' using errcode = 'P0001';
  end if;
  if req.status <> 'pending' then
    return json_build_object('result', req.status);
  end if;
  if public.gl_event_over(ev) then
    update public.gate_requests set status = 'declined', decided_at = now() where id = req.id;
    raise exception 'GL_EVENT_ENDED: This event has ended, so the gate is closed.' using errcode = 'P0001';
  end if;

  if not p_approve then
    update public.gate_requests set status = 'declined', decided_at = now() where id = req.id;
    return json_build_object('result', 'declined');
  end if;

  insert into public.guests (event_id, name, admits, checked_in_at, check_in_method)
  values (req.event_id, req.name, req.admits, now(), 'manual')
  returning * into g;

  update public.gate_requests set status = 'approved', decided_at = now(), guest_id = g.id where id = req.id;
  return json_build_object('result', 'approved', 'guest_id', g.id);
end;
$$;
revoke all on function public.gl_decide_request(uuid, boolean) from public, anon;
grant execute on function public.gl_decide_request(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Auto-end: mark events as ended 24h after they start.
-- ---------------------------------------------------------------------------
-- All hosts (for a scheduled job).
create or replace function public.gl_end_overdue()
returns int
language sql
security definer
set search_path = ''
as $$
  with done as (
    update public.events
       set status = 'ended', ended_at = now(), ended_by = 'auto'
     where status = 'active' and starts_at < now() - interval '24 hours'
    returning 1
  )
  select count(*)::int from done
$$;
revoke all on function public.gl_end_overdue() from public, anon, authenticated;

-- The signed-in host's own events (the app calls this when the dashboard loads).
create or replace function public.end_my_overdue_events()
returns int
language sql
security definer
set search_path = ''
as $$
  with done as (
    update public.events
       set status = 'ended', ended_at = now(), ended_by = 'auto'
     where owner_id = auth.uid() and status = 'active' and starts_at < now() - interval '24 hours'
    returning 1
  )
  select count(*)::int from done
$$;
revoke all on function public.end_my_overdue_events() from public, anon;
grant execute on function public.end_my_overdue_events() to authenticated;

-- Optional: run every 15 minutes if pg_cron is enabled
-- (Supabase Dashboard → Database → Extensions → pg_cron). Safe to skip.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'guestlok-auto-end';
    perform cron.schedule('guestlok-auto-end', '*/15 * * * *', 'select public.gl_end_overdue()');
  else
    raise notice 'pg_cron not enabled: events still end on time (the gate closes at +24h and the app tidies up on load).';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Reopen: within 1 hour of the host ending it, and only before the 24h cutoff.
-- ---------------------------------------------------------------------------
create or replace function public.gl_reopen_event(p_event uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev public.events;
begin
  select * into ev from public.events where id = p_event for update;
  if not found or ev.owner_id is distinct from auth.uid() then
    raise exception 'GL_NOT_FOUND: Event not found.' using errcode = 'P0001';
  end if;
  if ev.status <> 'ended' then
    raise exception 'GL_NOT_ENDED: This event is still open.' using errcode = 'P0001';
  end if;
  if ev.ended_by is distinct from 'host' or ev.ended_at < now() - interval '1 hour' then
    raise exception 'GL_TOO_LATE: Events can only be reopened within an hour of ending them.' using errcode = 'P0001';
  end if;
  if ev.starts_at < now() - interval '24 hours' then
    raise exception 'GL_TOO_LATE: The gate closes 24 hours after the start time, so this event can’t be reopened.' using errcode = 'P0001';
  end if;

  update public.events set status = 'active', ended_at = null, ended_by = null
   where id = ev.id
   returning * into ev;
  return row_to_json(ev);
end;
$$;
revoke all on function public.gl_reopen_event(uuid) from public, anon;
grant execute on function public.gl_reopen_event(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Invite page: tell guests when the event is over.
-- ---------------------------------------------------------------------------
create or replace function public.get_invite(p_token text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'guest_name', g.name,
    'admits', g.admits,
    'token', g.token,
    'checked_in_at', g.checked_in_at,
    'event_name', e.name,
    'host_names', e.host_names,
    'starts_at', e.starts_at,
    'venue', e.venue,
    'notes', e.notes,
    'card_theme', e.card_theme,
    'cover_image_url', e.cover_image_url,
    'cover_fit', e.cover_fit,
    'cover_position', e.cover_position,
    'cover_zoom', e.cover_zoom,
    'event_over', public.gl_event_over(e)
  )
  from public.guests g
  join public.events e on e.id = g.event_id
  where g.token = lower(p_token)
    and e.status in ('active', 'ended')
$$;

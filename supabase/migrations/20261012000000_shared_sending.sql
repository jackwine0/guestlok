-- Guestlok — share the sending, and a switch for Plus
-- Run this AFTER 20261011000000_plus_delivery.sql (SQL Editor → paste → Run).
--
-- 1. Plus ("Guestlok sends your invites") can be switched off while WhatsApp setup is pending.
--    It starts OFF. Turn it on later with:  update public.pricing_settings set plus_enabled = true;
-- 2. Sender links: the host shares a private link with a helper (sister, planner's assistant…)
--    who sends one side's invites from their own WhatsApp. No sign-up needed.
-- 3. WhatsApp delivery fields on guests can only be written by Guestlok's server, not by hosts.

-- ---------------------------------------------------------------------------
-- 1. Plus switch
-- ---------------------------------------------------------------------------
alter table public.pricing_settings
  add column if not exists plus_enabled boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Sender links
-- ---------------------------------------------------------------------------
create table if not exists public.event_senders (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 60),
  side       text check (side is null or char_length(side) between 1 and 40),  -- null = everyone
  token      text not null unique default public.gl_random_hex(16),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists event_senders_event_idx on public.event_senders (event_id);

alter table public.event_senders enable row level security;
drop policy if exists "owners manage senders" on public.event_senders;
create policy "owners manage senders" on public.event_senders for all
  using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid() and e.status = 'active'));

-- Hosts may rename or revoke a link, never change its token or move it to another event.
create or replace function public.gl_senders_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and tg_op = 'UPDATE' then
    new.token := old.token;
    new.event_id := old.event_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
drop trigger if exists senders_guard on public.event_senders;
create trigger senders_guard before update on public.event_senders
for each row execute function public.gl_senders_guard();

-- Which link sent each invite (so the host sees progress per helper).
alter table public.guests
  add column if not exists invite_sent_by uuid references public.event_senders (id) on delete set null;

-- What a helper sees when they open /send/<token>: the event and their guests.
create or replace function public.sender_queue(p_token text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'label', s.label,
    'side', s.side,
    'event', json_build_object(
      'name', e.name,
      'host_names', e.host_names,
      'starts_at', e.starts_at,
      'venue', e.venue,
      'invite_message', e.invite_message
    ),
    'guests', coalesce((
      select json_agg(json_build_object(
        'id', g.id,
        'name', g.name,
        'phone', g.phone,
        'admits', g.admits,
        'token', g.token,
        'side', g.side,
        'invite_sent_at', g.invite_sent_at,
        'checked_in_at', g.checked_in_at
      ) order by (g.invite_sent_at is not null), g.name)
      from public.guests g
      where g.event_id = e.id
        and g.phone is not null
        and (s.side is null or g.side = s.side)
    ), '[]'::json)
  )
  from public.event_senders s
  join public.events e on e.id = s.event_id
  where s.token = lower(p_token)
    and s.revoked_at is null
    and e.status = 'active'
    and e.starts_at > now() - interval '24 hours'
$$;

-- A helper marks one of their guests as sent.
create or replace function public.sender_mark_sent(p_token text, p_guest uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.event_senders;
begin
  select * into s from public.event_senders
   where token = lower(p_token) and revoked_at is null;
  if not found then
    return false;
  end if;
  update public.guests g
     set invite_sent_at = now(), invite_sent_by = s.id
   from public.events e
   where g.id = p_guest
     and g.event_id = s.event_id
     and e.id = g.event_id
     and e.status = 'active'
     and (s.side is null or g.side = s.side);
  return found;
end;
$$;

grant execute on function public.sender_queue(text) to anon, authenticated;
grant execute on function public.sender_mark_sent(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. WhatsApp delivery fields are server-only
-- ---------------------------------------------------------------------------
create or replace function public.gl_guests_wa_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.wa_status := null;
      new.wa_message_id := null;
      new.wa_error := null;
      new.wa_updated_at := null;
      new.invite_sent_by := null;
    else
      new.wa_status := old.wa_status;
      new.wa_message_id := old.wa_message_id;
      new.wa_error := old.wa_error;
      new.wa_updated_at := old.wa_updated_at;
      new.invite_sent_by := old.invite_sent_by;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guests_wa_guard on public.guests;
create trigger guests_wa_guard before insert or update on public.guests
for each row execute function public.gl_guests_wa_guard();

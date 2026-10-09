-- Guestlok — initial schema
-- Tables: tiers, events, guests, payments
-- Public access goes ONLY through the security-definer RPCs at the bottom.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.gl_random_hex(n_bytes int)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(n_bytes), 'hex')
$$;

-- ---------------------------------------------------------------------------
-- Tiers (headcount pricing). Prices are in kobo (₦1 = 100 kobo).
-- ---------------------------------------------------------------------------
create table public.tiers (
  id            text primary key,
  name          text not null,
  max_headcount int  not null check (max_headcount > 0),
  price_kobo    int  not null check (price_kobo > 0),
  sort          int  not null default 0
);

-- PLACEHOLDER PRICES: change these to your real prices before launch.
insert into public.tiers (id, name, max_headcount, price_kobo, sort) values
  ('intimate', 'Intimate', 100, 1500000, 1),  -- ₦15,000 (placeholder)
  ('owambe',   'Owambe',   300, 3500000, 2),  -- ₦35,000 (placeholder)
  ('grand',    'Grand',    500, 5500000, 3);  -- ₦55,000 (placeholder)

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name        text not null check (char_length(name) between 2 and 120),
  host_names  text check (char_length(host_names) <= 120),
  starts_at   timestamptz not null,
  venue       text not null check (char_length(venue) between 2 and 200),
  notes       text check (char_length(notes) <= 1000),
  tier_id     text not null references public.tiers (id),
  headcount   int  not null default 0,          -- set from the tier when paid
  status      text not null default 'draft' check (status in ('draft', 'active', 'ended')),
  scanner_key text not null unique default public.gl_random_hex(12),
  created_at  timestamptz not null default now()
);

create index events_owner_idx on public.events (owner_id, starts_at desc);

-- Hosts may edit details, but never status / headcount / owner (payments do that).
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
    else
      new.status := case
        when old.status = 'active' and new.status = 'ended' then 'ended'  -- host may close an event
        else old.status end;
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

create trigger events_guard
before insert or update on public.events
for each row execute function public.gl_events_guard();

-- ---------------------------------------------------------------------------
-- Guests
-- ---------------------------------------------------------------------------
create table public.guests (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 120),
  phone           text check (phone ~ '^[0-9]{10,15}$'),
  admits          int  not null default 1 check (admits between 1 and 10),
  token           text not null unique default public.gl_random_hex(16),
  checked_in_at   timestamptz,
  check_in_method text check (check_in_method in ('qr', 'manual')),
  invite_sent_at  timestamptz,
  created_at      timestamptz not null default now()
);

create index guests_event_idx on public.guests (event_id, name);

-- Enforce: event must be paid (active) and total admits must fit the headcount.
create or replace function public.gl_guests_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ev public.events;
  used int;
begin
  -- Hosts can't forge check-ins or tokens directly.
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.token := public.gl_random_hex(16);
      new.checked_in_at := null;
      new.check_in_method := null;
    else
      new.token := old.token;
      new.event_id := old.event_id;
      -- Hosts may UNDO a check-in, but not create one.
      if new.checked_in_at is not null and old.checked_in_at is null then
        new.checked_in_at := null;
        new.check_in_method := null;
      end if;
      if new.checked_in_at is null then
        new.check_in_method := null;
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' and new.admits = old.admits then
    return new;
  end if;

  select * into ev from public.events where id = new.event_id for update;

  if ev.status <> 'active' then
    raise exception 'GL_EVENT_NOT_ACTIVE: Pay for this event before adding guests.'
      using errcode = 'P0001';
  end if;

  select coalesce(sum(admits), 0) into used
  from public.guests
  where event_id = new.event_id
    and (tg_op = 'INSERT' or id <> new.id);

  if used + new.admits > ev.headcount then
    raise exception 'GL_CAPACITY: This would take you to % people. Your plan allows %.',
      used + new.admits, ev.headcount
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger guests_capacity
before insert or update on public.guests
for each row execute function public.gl_guests_capacity();

-- ---------------------------------------------------------------------------
-- Payments (written only by edge functions with the service role)
-- ---------------------------------------------------------------------------
create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  tier_id     text not null references public.tiers (id),
  reference   text not null unique,
  amount_kobo int  not null,
  status      text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);

-- Called by edge functions after Paystack confirms a charge. Idempotent.
create or replace function public.gl_activate_payment(p_reference text, p_amount_kobo int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments;
  tier public.tiers;
begin
  select * into pay from public.payments where reference = p_reference for update;
  if not found then
    return 'unknown_reference';
  end if;
  if pay.status = 'success' then
    return 'already_active';
  end if;
  if p_amount_kobo < pay.amount_kobo then
    update public.payments set status = 'failed' where id = pay.id;
    return 'amount_mismatch';
  end if;

  select * into tier from public.tiers where id = pay.tier_id;

  update public.payments set status = 'success', paid_at = now() where id = pay.id;
  update public.events
     set status = 'active', headcount = tier.max_headcount, tier_id = tier.id
   where id = pay.event_id;
  return 'activated';
end;
$$;

revoke all on function public.gl_activate_payment(text, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.tiers    enable row level security;
alter table public.events   enable row level security;
alter table public.guests   enable row level security;
alter table public.payments enable row level security;

create policy "tiers are public" on public.tiers for select using (true);

create policy "owners read events"   on public.events for select using (owner_id = auth.uid());
create policy "owners create events" on public.events for insert with check (owner_id = auth.uid());
create policy "owners update events" on public.events for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete drafts" on public.events for delete using (owner_id = auth.uid() and status = 'draft');

create policy "owners manage guests" on public.guests for all
  using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));

create policy "owners read payments" on public.payments for select using (owner_id = auth.uid());

-- Live dashboard
alter publication supabase_realtime add table public.guests;

-- ---------------------------------------------------------------------------
-- Public RPCs (invite page + gate scanner). No login needed; access is by
-- secret token (guests) or secret scanner key (ushers).
-- ---------------------------------------------------------------------------

-- Invite page
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
    'notes', e.notes
  )
  from public.guests g
  join public.events e on e.id = g.event_id
  where g.token = lower(p_token)
    and e.status in ('active', 'ended')
$$;

-- Internal: validate an usher's scanner key.
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
  )
$$;

revoke all on function public.gl_scanner_ok(uuid, text) from public, anon, authenticated;

-- Scanner header info + live counts
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
$$;

-- Shared check-in logic. Exactly one usher wins a race for the same code.
create or replace function public.gl_check_in(p_event uuid, p_guest uuid, p_token text, p_method text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.guests;
begin
  update public.guests
     set checked_in_at = now(), check_in_method = p_method
   where event_id = p_event
     and checked_in_at is null
     and ((p_guest is not null and id = p_guest) or (p_token is not null and token = lower(p_token)))
  returning * into g;

  if found then
    return json_build_object('result', 'valid', 'guest_name', g.name, 'admits', g.admits, 'checked_in_at', g.checked_in_at);
  end if;

  select * into g from public.guests
   where event_id = p_event
     and ((p_guest is not null and id = p_guest) or (p_token is not null and token = lower(p_token)));

  if found then
    return json_build_object('result', 'used', 'guest_name', g.name, 'admits', g.admits, 'checked_in_at', g.checked_in_at);
  end if;

  return json_build_object('result', 'not_invited');
end;
$$;

revoke all on function public.gl_check_in(uuid, uuid, text, text) from public, anon, authenticated;

create or replace function public.scanner_check_in(p_event uuid, p_key text, p_token text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.gl_scanner_ok(p_event, p_key) then
    return json_build_object('result', 'invalid_key');
  end if;
  if p_token is null or p_token !~* '^[a-f0-9]{32}$' then
    return json_build_object('result', 'not_invited');
  end if;
  return public.gl_check_in(p_event, null, p_token, 'qr');
end;
$$;

create or replace function public.scanner_manual_check_in(p_event uuid, p_key text, p_guest uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.gl_scanner_ok(p_event, p_key) then
    return json_build_object('result', 'invalid_key');
  end if;
  return public.gl_check_in(p_event, p_guest, null, 'manual');
end;
$$;

-- Name lookup at the gate (for guests without a phone / dead battery)
create or replace function public.scanner_search(p_event uuid, p_key text, p_query text)
returns table (id uuid, name text, admits int, checked_in_at timestamptz, phone_last4 text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q text := trim(regexp_replace(coalesce(p_query, ''), '[%_\\]', '', 'g'));
begin
  if not public.gl_scanner_ok(p_event, p_key) or char_length(q) < 2 then
    return;
  end if;
  return query
    select g.id, g.name, g.admits, g.checked_in_at, right(g.phone, 4)
    from public.guests g
    where g.event_id = p_event
      and g.name ilike '%' || q || '%'
    order by g.name
    limit 20;
end;
$$;

grant execute on function public.get_invite(text) to anon, authenticated;
grant execute on function public.scanner_event(uuid, text) to anon, authenticated;
grant execute on function public.scanner_check_in(uuid, text, text) to anon, authenticated;
grant execute on function public.scanner_manual_check_in(uuid, text, uuid) to anon, authenticated;
grant execute on function public.scanner_search(uuid, text, text) to anon, authenticated;

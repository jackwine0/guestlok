-- Guestlok — Standard vs Plus ("Guestlok sends your invites on WhatsApp")
-- Run this AFTER 20261010000000_ending_events.sql (SQL Editor → paste → Run).
--
-- Standard: the host sends invites from their own WhatsApp (free, as before).
-- Plus:     Guestlok sends every invite from the official Guestlok WhatsApp number.
--           Price = plan price + 30% (at least ₦30 a guest), rounded up to the next ₦100.
--           Includes sends for the plan size + 10% for resends; extra invites can be topped up.
--
-- All numbers live in public.pricing_settings so you can change them without a code change:
--   update public.pricing_settings set plus_pct = 35;

-- ---------------------------------------------------------------------------
-- Pricing settings (one row)
-- ---------------------------------------------------------------------------
create table if not exists public.pricing_settings (
  id                  boolean primary key default true check (id),
  plus_pct            numeric not null default 30  check (plus_pct between 0 and 300),
  plus_min_guest_kobo int     not null default 3000  check (plus_min_guest_kobo >= 0),  -- ₦30 per guest floor
  extra_invite_kobo   int     not null default 10000 check (extra_invite_kobo > 0),     -- ₦100 per top-up invite
  resend_pct          int     not null default 10  check (resend_pct between 0 and 100),
  updated_at          timestamptz not null default now()
);
insert into public.pricing_settings (id) values (true) on conflict (id) do nothing;

alter table public.pricing_settings enable row level security;
drop policy if exists "pricing is public" on public.pricing_settings;
create policy "pricing is public" on public.pricing_settings for select using (true);

-- What Plus adds on top of a plan, in kobo.
create or replace function public.gl_plus_extra_kobo(p_tier text)
returns int
language sql
stable
set search_path = ''
as $$
  select (ceil(greatest(t.price_kobo * s.plus_pct / 100.0, s.plus_min_guest_kobo * t.max_headcount) / 10000.0) * 10000)::int
  from public.tiers t, public.pricing_settings s
  where t.id = p_tier
$$;

-- How many WhatsApp sends a Plus event gets for its plan size.
create or replace function public.gl_plus_quota(p_headcount int)
returns int
language sql
stable
set search_path = ''
as $$
  select ceil(p_headcount * (1 + s.resend_pct / 100.0))::int from public.pricing_settings s
$$;

-- ---------------------------------------------------------------------------
-- Events: how invites go out, and the WhatsApp allowance
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists delivery text not null default 'self' check (delivery in ('self', 'plus')),
  add column if not exists wa_quota int not null default 0 check (wa_quota >= 0),
  add column if not exists wa_sent  int not null default 0 check (wa_sent >= 0);

-- Same guard as before, plus: delivery can only be chosen while the event is a draft,
-- and hosts can never change the WhatsApp allowance (payments do that).
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
      new.wa_quota := 0;
      new.wa_sent := 0;
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
      new.wa_quota := old.wa_quota;
      new.wa_sent := old.wa_sent;
      if old.status <> 'draft' then
        new.tier_id := old.tier_id;    -- tier is locked once paid
        new.delivery := old.delivery;  -- upgrading to Plus goes through a payment
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments: plan, upgrade to Plus, or extra invites
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists kind     text not null default 'plan' check (kind in ('plan', 'upgrade', 'topup')),
  add column if not exists delivery text not null default 'self' check (delivery in ('self', 'plus')),
  add column if not exists invites  int check (invites is null or invites > 0);

create or replace function public.gl_activate_payment(p_reference text, p_amount_kobo int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments;
  tier public.tiers;
  ev public.events;
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

  select * into ev from public.events where id = pay.event_id for update;
  update public.payments set status = 'success', paid_at = now() where id = pay.id;

  if pay.kind = 'plan' then
    select * into tier from public.tiers where id = pay.tier_id;
    update public.events
       set status = 'active',
           headcount = tier.max_headcount,
           tier_id = tier.id,
           delivery = pay.delivery,
           wa_quota = case when pay.delivery = 'plus' then public.gl_plus_quota(tier.max_headcount) else 0 end
     where id = pay.event_id;
    return 'activated';
  elsif pay.kind = 'upgrade' then
    update public.events
       set delivery = 'plus',
           wa_quota = greatest(wa_quota, public.gl_plus_quota(ev.headcount))
     where id = pay.event_id;
    return 'upgraded';
  else
    update public.events set wa_quota = wa_quota + coalesce(pay.invites, 0) where id = pay.event_id;
    return 'topped_up';
  end if;
end;
$$;
revoke all on function public.gl_activate_payment(text, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guests: WhatsApp delivery status (filled in by the whatsapp-send / webhook functions)
-- ---------------------------------------------------------------------------
alter table public.guests
  add column if not exists wa_status     text check (wa_status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  add column if not exists wa_message_id text,
  add column if not exists wa_error      text,
  add column if not exists wa_updated_at timestamptz;
create unique index if not exists guests_wa_message_idx on public.guests (wa_message_id) where wa_message_id is not null;

-- Reserve up to p_count sends from an event's allowance (row-locked). Returns how many were granted.
create or replace function public.gl_wa_reserve(p_event uuid, p_count int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev public.events;
  granted int;
begin
  select * into ev from public.events where id = p_event for update;
  if not found or ev.delivery <> 'plus' or ev.status <> 'active' then
    return 0;
  end if;
  granted := least(greatest(p_count, 0), greatest(ev.wa_quota - ev.wa_sent, 0));
  update public.events set wa_sent = wa_sent + granted where id = p_event;
  return granted;
end;
$$;

-- Give sends back (a message failed before it reached WhatsApp, or WhatsApp rejected it).
create or replace function public.gl_wa_release(p_event uuid, p_count int)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.events set wa_sent = greatest(wa_sent - greatest(p_count, 0), 0) where id = p_event
$$;

revoke all on function public.gl_wa_reserve(uuid, int) from public, anon, authenticated;
revoke all on function public.gl_wa_release(uuid, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ticket images WhatsApp attaches to each invite. Public URLs (Meta must fetch them),
-- but every file name contains the guest's secret token, so they can't be guessed.
-- Path: <owner id>/<event id>/<guest token>.png
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invite-tickets', 'invite-tickets', true, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "hosts upload own tickets" on storage.objects;
drop policy if exists "hosts read own tickets" on storage.objects;
drop policy if exists "hosts update own tickets" on storage.objects;
drop policy if exists "hosts delete own tickets" on storage.objects;

create policy "hosts upload own tickets" on storage.objects for insert to authenticated
  with check (bucket_id = 'invite-tickets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "hosts read own tickets" on storage.objects for select to authenticated
  using (bucket_id = 'invite-tickets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "hosts update own tickets" on storage.objects for update to authenticated
  using (bucket_id = 'invite-tickets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "hosts delete own tickets" on storage.objects for delete to authenticated
  using (bucket_id = 'invite-tickets' and (storage.foldername(name))[1] = auth.uid()::text);

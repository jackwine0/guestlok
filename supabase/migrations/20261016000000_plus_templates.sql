-- Guestlok — Plus on WhatsApp Utility pricing, message styles, host note, daily limit
-- Run this AFTER 20261015000000_short_links.sql (SQL Editor → paste → Run).
--
-- 1. Plus price: a flat ₦20 per guest of the plan (no percentage); top-ups ₦25 per invite.
--    Change any time: update public.pricing_settings set plus_min_guest_kobo = 2500;
-- 2. Message styles: hosts pick one of your approved WhatsApp templates and can add a
--    short note. List a template here only after Meta has approved it:
--      update public.pricing_settings
--         set wa_templates = '{guestlok_invite,guestlok_invite_formal,guestlok_invite_warm}';
-- 3. Daily limit: every Plus event sends from your one number, which Meta limits to a
--    number of people per 24 hours (250 until your business is verified). Sends stop
--    there instead of failing; raise it when Meta raises yours:
--      update public.pricing_settings set wa_daily_limit = 1000;
-- 4. When you're ready for hosts to buy Plus:
--      update public.pricing_settings set plus_enabled = true;

update public.pricing_settings
   set plus_pct = 0,
       plus_min_guest_kobo = 2000,
       extra_invite_kobo = 2500,
       updated_at = now();

alter table public.pricing_settings
  add column if not exists wa_templates text[] not null default '{guestlok_invite}';
alter table public.pricing_settings
  add column if not exists wa_daily_limit int not null default 250 check (wa_daily_limit >= 0);

-- The host's choice for their event.
alter table public.events
  add column if not exists wa_template text not null default 'guestlok_invite'
  check (wa_template ~ '^[a-z0-9_]{1,60}$');
alter table public.events
  add column if not exists wa_note text check (char_length(wa_note) <= 120);

-- When Guestlok's number sent each invite (for the 24-hour limit).
alter table public.guests add column if not exists wa_sent_at timestamptz;
create index if not exists guests_wa_sent_at_idx on public.guests (wa_sent_at) where wa_sent_at is not null;

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
      new.wa_sent_at := null;
      new.invite_sent_by := null;
      new.code := public.gl_short_code();
    else
      new.wa_status := old.wa_status;
      new.wa_message_id := old.wa_message_id;
      new.wa_error := old.wa_error;
      new.wa_updated_at := old.wa_updated_at;
      new.wa_sent_at := old.wa_sent_at;
      new.invite_sent_by := old.invite_sent_by;
      new.code := old.code;
    end if;
  end if;
  return new;
end;
$$;

-- People messaged from Guestlok's number in the last 24 hours (all events).
create or replace function public.gl_wa_sent_today()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.guests where wa_sent_at > now() - interval '24 hours'
$$;
revoke all on function public.gl_wa_sent_today() from public, anon, authenticated;

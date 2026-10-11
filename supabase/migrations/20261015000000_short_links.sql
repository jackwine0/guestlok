-- Guestlok — short invite links
-- Run this AFTER 20261014000000_whatsapp_ticket_preview.sql (SQL Editor → paste → Run).
--
-- Every guest gets a 10-character code, so invites can use /i/k7qp2xza9m instead of
-- the 32-character token. Old links keep working.

-- ---------------------------------------------------------------------------
-- Short invite codes
-- ---------------------------------------------------------------------------
-- No 0/o, 1/l/i: easy to read out or type from a message.
create or replace function public.gl_short_code(n int default 10)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  bytes bytea := extensions.gen_random_bytes(n);
  out text := '';
begin
  for i in 0 .. n - 1 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return out;
end;
$$;

alter table public.guests add column if not exists code text;
update public.guests set code = public.gl_short_code() where code is null;
alter table public.guests alter column code set default public.gl_short_code();
alter table public.guests alter column code set not null;
create unique index if not exists guests_code_key on public.guests (code);

-- The invite page and link previews accept the token or the short code.
create or replace function public.gl_guest_by_link(p_link text)
returns public.guests
language sql
stable
security definer
set search_path = ''
as $$
  select g.* from public.guests g
  where (length(p_link) = 32 and g.token = lower(p_link))
     or (length(p_link) = 10 and g.code = lower(p_link))
  limit 1
$$;
revoke all on function public.gl_guest_by_link(text) from public, anon, authenticated;

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
  from public.gl_guest_by_link(p_token) g
  join public.events e on e.id = g.event_id
  where g.id is not null
    and e.status in ('active', 'ended')
$$;
grant execute on function public.get_invite(text) to anon, authenticated;

create or replace function public.invite_preview(p_token text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'guest_name', g.name,
    'event_name', e.name,
    'host_names', e.host_names,
    'starts_at', e.starts_at,
    'venue', e.venue,
    'image_path', e.owner_id::text || '/' || e.id::text || '/' || g.token || '-wa.jpg'
  )
  from public.gl_guest_by_link(p_token) g
  join public.events e on e.id = g.event_id
  where g.id is not null
    and e.status <> 'draft'
$$;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- The short code is set by the database only (same rule as the WhatsApp fields).
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
      new.code := public.gl_short_code();
    else
      new.wa_status := old.wa_status;
      new.wa_message_id := old.wa_message_id;
      new.wa_error := old.wa_error;
      new.wa_updated_at := old.wa_updated_at;
      new.invite_sent_by := old.invite_sent_by;
      new.code := old.code;
    end if;
  end if;
  return new;
end;
$$;

-- Helpers' sending page gets the short code too, so their messages carry the short link.
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
      'notes', e.notes,
      'invite_message', e.invite_message,
      'card_theme', e.card_theme,
      'cover_image_url', e.cover_image_url,
      'cover_fit', e.cover_fit,
      'cover_position', e.cover_position,
      'cover_zoom', e.cover_zoom
    ),
    'guests', coalesce((
      select json_agg(json_build_object(
        'id', g.id,
        'name', g.name,
        'phone', g.phone,
        'admits', g.admits,
        'token', g.token,
        'code', g.code,
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
grant execute on function public.sender_queue(text) to anon, authenticated;

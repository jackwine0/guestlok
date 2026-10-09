-- Guestlok — cover photo framing
-- Run this AFTER 20261008000000_sides_and_gate_requests.sql (SQL Editor → paste → Run).
--
-- cover_fit:      'fill'  = crop to the card's frame (host can drag + zoom)
--                 'whole' = show the whole photo (good for flyers)
-- cover_position: focal point for 'fill', CSS object-position like '50% 30%'
-- cover_zoom:     1.00 – 3.00

alter table public.events
  add column if not exists cover_fit text not null default 'fill' check (cover_fit in ('fill', 'whole')),
  add column if not exists cover_position text not null default '50% 50%'
    check (cover_position ~ '^(100|[0-9]{1,2})(\.[0-9]+)?% (100|[0-9]{1,2})(\.[0-9]+)?%$'),
  add column if not exists cover_zoom numeric(4, 2) not null default 1 check (cover_zoom between 1 and 3);

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
    'cover_zoom', e.cover_zoom
  )
  from public.guests g
  join public.events e on e.id = g.event_id
  where g.token = lower(p_token)
    and e.status in ('active', 'ended')
$$;

-- Guestlok — the ticket image shows up inside the WhatsApp message
-- Run this AFTER 20261013000000_delete_events.sql (SQL Editor → paste → Run).
--
-- WhatsApp shows a preview of the first link in a message. When it looks at a guest's
-- invite link (/i/<token>), the site now answers with that guest's ticket image
-- (see middleware.js). The app uploads the image just before opening the chat:
--   invite-tickets/<owner>/<event>/<token>-wa.jpg
--
-- 1. invite_preview: what the link preview needs, by invite token (public, like get_invite).
-- 2. sender_queue: also returns the card design so helpers can make the same ticket image.

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
  from public.guests g
  join public.events e on e.id = g.event_id
  where g.token = lower(p_token)
    and e.status <> 'draft'
$$;

grant execute on function public.invite_preview(text) to anon, authenticated;

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

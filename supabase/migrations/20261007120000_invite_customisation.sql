-- Guestlok — invite customisation
-- Custom WhatsApp message, card colour theme and a cover photo per event.
-- Run this AFTER 20261007000000_init.sql (SQL Editor → paste → Run, or `npx supabase db push`).

alter table public.events
  add column if not exists invite_message  text check (char_length(invite_message) <= 1000),
  add column if not exists card_theme      text not null default 'ochre'
    check (card_theme in ('ochre', 'wine', 'emerald', 'midnight', 'blush')),
  add column if not exists cover_image_url text check (char_length(cover_image_url) <= 500);

-- Invite page now also needs the theme and cover photo.
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
    'cover_image_url', e.cover_image_url
  )
  from public.guests g
  join public.events e on e.id = g.event_id
  where g.token = lower(p_token)
    and e.status in ('active', 'ended')
$$;

-- ---------------------------------------------------------------------------
-- Storage: cover photos. Public read (they appear on invites); hosts can only
-- write inside a folder named after their own user id.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invite-covers', 'invite-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "hosts upload own covers" on storage.objects;
drop policy if exists "hosts read own covers" on storage.objects;
drop policy if exists "hosts update own covers" on storage.objects;
drop policy if exists "hosts delete own covers" on storage.objects;

create policy "hosts upload own covers" on storage.objects for insert to authenticated
  with check (bucket_id = 'invite-covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "hosts read own covers" on storage.objects for select to authenticated
  using (bucket_id = 'invite-covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "hosts update own covers" on storage.objects for update to authenticated
  using (bucket_id = 'invite-covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "hosts delete own covers" on storage.objects for delete to authenticated
  using (bucket_id = 'invite-covers' and (storage.foldername(name))[1] = auth.uid()::text);

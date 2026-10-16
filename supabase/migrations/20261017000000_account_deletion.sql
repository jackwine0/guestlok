-- Guestlok — hosts can delete their account (Account page → Delete my account)
-- Run this AFTER 20261016000000_plus_templates.sql (SQL Editor → paste → Run).
--
-- The delete-account Edge Function removes the host's events (guests, gate requests and
-- helper links go with them), their uploaded photos and tickets, and then their login.
-- Payment records are KEPT for your accounts and tax, but no longer linked to the person:
-- owner_id is cleared, and the event name was already copied on when the event went.

alter table public.payments alter column owner_id drop not null;
alter table public.payments drop constraint if exists payments_owner_id_fkey;
alter table public.payments
  add constraint payments_owner_id_fkey foreign key (owner_id) references auth.users (id) on delete set null;

-- Guestlok — guest "sides" + gate requests
-- Run this AFTER 20261007120000_invite_customisation.sql (SQL Editor → paste → Run).
--
-- 1. guests.side: an optional group such as "Bride's family" or "Work".
-- 2. gate_requests: an usher can ask the host to let in someone who is not on
--    the list. The host says yes or no from the dashboard. A "yes" adds the
--    person to the list and checks them in, within the plan's headcount.

alter table public.guests
  add column if not exists side text check (char_length(side) between 1 and 40);

-- ---------------------------------------------------------------------------
-- Gate requests
-- ---------------------------------------------------------------------------
create table if not exists public.gate_requests (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  note        text check (char_length(note) <= 200),
  admits      int  not null default 1 check (admits between 1 and 10),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  guest_id    uuid references public.guests (id) on delete set null,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);

create index if not exists gate_requests_event_idx on public.gate_requests (event_id, status, created_at desc);

alter table public.gate_requests enable row level security;

drop policy if exists "owners read gate requests" on public.gate_requests;
create policy "owners read gate requests" on public.gate_requests for select
  using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));

-- No insert/update/delete policies: everything goes through the functions below.

do $$
begin
  alter publication supabase_realtime add table public.gate_requests;
exception when duplicate_object then null;
end $$;

-- Usher: ask the host about someone who is not on the list.
create or replace function public.scanner_request(
  p_event uuid, p_key text, p_name text, p_note text, p_admits int
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending int;
  req public.gate_requests;
  clean_name text := left(trim(coalesce(p_name, '')), 120);
begin
  if not public.gl_scanner_ok(p_event, p_key) then
    return json_build_object('result', 'invalid_key');
  end if;
  if clean_name = '' then
    return json_build_object('result', 'missing_name');
  end if;

  select count(*) into pending from public.gate_requests
   where event_id = p_event and status = 'pending';
  if pending >= 20 then
    return json_build_object('result', 'too_many');
  end if;

  insert into public.gate_requests (event_id, name, note, admits)
  values (p_event, clean_name, nullif(left(trim(coalesce(p_note, '')), 200), ''),
          least(10, greatest(1, coalesce(p_admits, 1))))
  returning * into req;

  return json_build_object('result', 'sent', 'id', req.id);
end;
$$;

-- Usher: poll for the host's answer.
create or replace function public.scanner_request_status(p_event uuid, p_key text, p_request uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  req public.gate_requests;
begin
  if not public.gl_scanner_ok(p_event, p_key) then
    return json_build_object('result', 'invalid_key');
  end if;
  select * into req from public.gate_requests where id = p_request and event_id = p_event;
  if not found then
    return json_build_object('result', 'not_found');
  end if;
  return json_build_object('result', req.status, 'name', req.name, 'admits', req.admits);
end;
$$;

-- Host: say yes or no. "Yes" adds the person to the list and checks them in.
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
  select r.* into req from public.gate_requests r
   where r.id = p_request
   for update;
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

  if not p_approve then
    update public.gate_requests set status = 'declined', decided_at = now() where id = req.id;
    return json_build_object('result', 'declined');
  end if;

  -- Capacity trigger still applies: raises GL_CAPACITY if the plan is full.
  insert into public.guests (event_id, name, admits, checked_in_at, check_in_method)
  values (req.event_id, req.name, req.admits, now(), 'manual')
  returning * into g;

  update public.gate_requests
     set status = 'approved', decided_at = now(), guest_id = g.id
   where id = req.id;

  return json_build_object('result', 'approved', 'guest_id', g.id);
end;
$$;

revoke all on function public.scanner_request(uuid, text, text, text, int) from public;
revoke all on function public.scanner_request_status(uuid, text, uuid) from public;
revoke all on function public.gl_decide_request(uuid, boolean) from public, anon;

grant execute on function public.scanner_request(uuid, text, text, text, int) to anon, authenticated;
grant execute on function public.scanner_request_status(uuid, text, uuid) to anon, authenticated;
grant execute on function public.gl_decide_request(uuid, boolean) to authenticated;

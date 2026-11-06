-- Stage 3: requests to borrow, and loans.
-- Run once in Supabase: SQL Editor > New query > paste this whole file > Run.

-- A member asking to borrow one copy.
--   open      waiting for the owner
--   accepted  the owner accepted (used with "WhatsApp after I accept a request")
--   lent      the owner handed the book over; see loans
--   declined  the owner said no
--   cancelled the member withdrew, or the copy was removed
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  copy_id uuid not null references public.copies (id) on delete cascade,
  requester_id uuid not null references public.members (id) on delete cascade,
  status text not null default 'open'
    check (status in ('open', 'accepted', 'lent', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  closed_at timestamptz
);

create unique index requests_one_live_per_member
  on public.requests (copy_id, requester_id) where status in ('open', 'accepted');
create index requests_copy on public.requests (copy_id) where status in ('open', 'accepted');

-- A copy in someone else's hands.
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  copy_id uuid not null references public.copies (id) on delete cascade,
  borrower_id uuid not null references public.members (id) on delete cascade,
  request_id uuid references public.requests (id) on delete set null,
  lent_at timestamptz not null default now(),
  -- When the overdue-reminder clock started; reset when the borrower says
  -- they still need the book (Stage 4).
  reminder_from timestamptz not null default now(),
  returned_at timestamptz
);

create unique index loans_one_active_per_copy on public.loans (copy_id) where returned_at is null;
create index loans_borrower on public.loans (borrower_id) where returned_at is null;

-- So every member can see a copy is lent out without seeing who has it.
alter table public.copies add column on_loan boolean not null default false;

alter table public.requests enable row level security;
alter table public.loans enable row level security;

-- Only the two people involved see a request or a loan.
create policy "requests are visible to the asker and the owner"
  on public.requests for select to authenticated
  using (
    requester_id = auth.uid()
    or exists (select 1 from public.copies c where c.id = copy_id and c.owner_id = auth.uid())
  );

create policy "loans are visible to the borrower and the owner"
  on public.loans for select to authenticated
  using (
    borrower_id = auth.uid()
    or exists (select 1 from public.copies c where c.id = copy_id and c.owner_id = auth.uid())
  );

-- All changes go through the functions below, which check the rules.
revoke all on public.requests, public.loans from anon, authenticated;
grant select on public.requests, public.loans to authenticated;
revoke update (removed_at) on public.copies from authenticated;

create function public.require_member()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_approved() then
    raise exception 'not_member';
  end if;
  return auth.uid();
end;
$$;

-- Ask to borrow a copy. Returns the request's id.
create function public.request_copy(p_copy uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := public.require_member();
  c record;
  existing uuid;
  new_id uuid;
begin
  select cp.owner_id, cp.removed_at, cp.on_loan, o.status, o.lending_paused
    into c
    from public.copies cp join public.members o on o.id = cp.owner_id
    where cp.id = p_copy
    for update of cp;
  if not found or c.removed_at is not null or c.status <> 'approved' then
    raise exception 'not_available';
  end if;
  if c.owner_id = me then raise exception 'own_book'; end if;
  if c.lending_paused then raise exception 'paused'; end if;
  if c.on_loan then raise exception 'lent_out'; end if;

  select id into existing from public.requests
    where copy_id = p_copy and requester_id = me and status in ('open', 'accepted');
  if existing is not null then return existing; end if;

  insert into public.requests (copy_id, requester_id) values (p_copy, me) returning id into new_id;
  return new_id;
end;
$$;

create function public.cancel_request(p_request uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := public.require_member();
begin
  update public.requests set status = 'cancelled', closed_at = now()
    where id = p_request and requester_id = me and status in ('open', 'accepted');
end;
$$;

-- The owner's actions. Each checks that the copy belongs to the caller.
create function public.accept_request(p_request uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := public.require_member();
begin
  update public.requests r set status = 'accepted', accepted_at = now()
    from public.copies c
    where r.id = p_request and c.id = r.copy_id and c.owner_id = me and r.status = 'open';
end;
$$;

create function public.decline_request(p_request uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := public.require_member();
begin
  update public.requests r set status = 'declined', closed_at = now()
    from public.copies c
    where r.id = p_request and c.id = r.copy_id and c.owner_id = me
      and r.status in ('open', 'accepted');
end;
$$;

create function public.mark_lent(p_request uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := public.require_member();
  r record;
begin
  select rq.id, rq.copy_id, rq.requester_id, cp.on_loan, cp.removed_at
    into r
    from public.requests rq join public.copies cp on cp.id = rq.copy_id
    where rq.id = p_request and cp.owner_id = me and rq.status in ('open', 'accepted')
    for update of cp;
  if not found then raise exception 'not_found'; end if;
  if r.removed_at is not null then raise exception 'not_available'; end if;
  if r.on_loan then raise exception 'lent_out'; end if;

  insert into public.loans (copy_id, borrower_id, request_id) values (r.copy_id, r.requester_id, r.id);
  update public.requests set status = 'lent', closed_at = now() where id = r.id;
  update public.copies set on_loan = true where id = r.copy_id;
end;
$$;

create function public.mark_returned(p_loan uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := public.require_member();
  l record;
begin
  select ln.id, ln.copy_id into l
    from public.loans ln join public.copies cp on cp.id = ln.copy_id
    where ln.id = p_loan and cp.owner_id = me and ln.returned_at is null
    for update of ln;
  if not found then return; end if;
  update public.loans set returned_at = now() where id = l.id;
  update public.copies set on_loan = false where id = l.copy_id;
end;
$$;

-- Removing a book cancels its open requests. A lent-out copy's loan stays
-- until the owner marks it returned.
create function public.remove_copy(p_copy uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := public.require_member();
begin
  update public.copies set removed_at = now()
    where id = p_copy and owner_id = me and removed_at is null;
  if found then
    update public.requests set status = 'cancelled', closed_at = now()
      where copy_id = p_copy and status in ('open', 'accepted');
  end if;
end;
$$;

revoke all on function
  public.require_member(), public.request_copy(uuid), public.cancel_request(uuid),
  public.accept_request(uuid), public.decline_request(uuid), public.mark_lent(uuid),
  public.mark_returned(uuid), public.remove_copy(uuid)
  from public, anon;
grant execute on function
  public.request_copy(uuid), public.cancel_request(uuid), public.accept_request(uuid),
  public.decline_request(uuid), public.mark_lent(uuid), public.mark_returned(uuid),
  public.remove_copy(uuid)
  to authenticated;

-- What one member may see of another's contact details, now that requests
-- exist. Returns nothing, or one row: kind is 'whatsapp' or 'email'.
create or replace function public.get_contact(target uuid)
returns table (kind text, value text)
language sql stable security definer set search_path = ''
as $$
  select
    case when m.contact_setting = 'email_only' then 'email' else 'whatsapp' end,
    case when m.contact_setting = 'email_only' then c.email else c.whatsapp end
  from public.members m
  join public.member_contacts c on c.member_id = m.id
  where m.id = target
    and m.status = 'approved'
    and public.is_approved()
    and (
      m.id = auth.uid()
      or m.contact_setting <> 'whatsapp_after_accept'
      -- The owner accepted my request, or lent me the book.
      or exists (
        select 1 from public.requests r join public.copies cp on cp.id = r.copy_id
        where r.requester_id = auth.uid() and cp.owner_id = target
          and r.status in ('accepted', 'lent')
      )
      -- An owner always sees whoever asked for their book.
      or exists (
        select 1 from public.requests r join public.copies cp on cp.id = r.copy_id
        where r.requester_id = target and cp.owner_id = auth.uid()
          and r.status in ('open', 'accepted', 'lent')
      )
    );
$$;

-- Stage 4: waitlists, lending limits, overdue reminders and pause lending.
-- Run once in Supabase: SQL Editor > New query > paste this whole file > Run.

-- Requests that moved to a waitlist get their own status, and requests made
-- automatically for the first person in line are marked.
alter table public.requests drop constraint requests_status_check;
alter table public.requests add constraint requests_status_check
  check (status in ('open', 'accepted', 'lent', 'declined', 'cancelled', 'waitlisted'));
alter table public.requests add column from_waitlist boolean not null default false;

-- When the one overdue reminder was emailed (Stage 5 sends it).
alter table public.loans add column reminder_sent_at timestamptz;

-- The line for one copy, in the order members joined.
--   reason: why they are waiting rather than asking
--     lent_out        someone has the copy
--     line            others were already waiting
--     limit_total     the owner lends only so many books at a time
--     limit_borrower  the owner lends only so many books to one person
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  copy_id uuid not null references public.copies (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  joined_at timestamptz not null default now(),
  status text not null default 'waiting' check (status in ('waiting', 'left', 'promoted', 'removed')),
  reason text not null default 'lent_out'
    check (reason in ('lent_out', 'line', 'limit_total', 'limit_borrower')),
  closed_at timestamptz
);

create unique index waitlist_one_per_member on public.waitlist (copy_id, member_id) where status = 'waiting';
create index waitlist_line on public.waitlist (copy_id, joined_at) where status = 'waiting';

alter table public.waitlist enable row level security;

create policy "waitlist places are visible to the member and the owner"
  on public.waitlist for select to authenticated
  using (
    member_id = auth.uid()
    or exists (select 1 from public.copies c where c.id = copy_id and c.owner_id = auth.uid())
  );

revoke all on public.waitlist from anon, authenticated;
grant select on public.waitlist to authenticated;

-- Which lending limit, if any, stops this owner lending to this member now.
create function public.limit_reason(p_owner uuid, p_member uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when o.max_lent_at_once is not null and (
      select count(*) from public.loans l join public.copies c on c.id = l.copy_id
      where c.owner_id = p_owner and l.returned_at is null
    ) >= o.max_lent_at_once then 'limit_total'
    when p_member is not null and o.max_per_borrower is not null and (
      select count(*) from public.loans l join public.copies c on c.id = l.copy_id
      where c.owner_id = p_owner and l.borrower_id = p_member and l.returned_at is null
    ) >= o.max_per_borrower then 'limit_borrower'
  end
  from public.members o where o.id = p_owner;
$$;

-- Others are already in line for this copy, or the first in line has it on request.
create function public.has_line(p_copy uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.waitlist where copy_id = p_copy and status = 'waiting')
      or exists (
        select 1 from public.requests
        where copy_id = p_copy and from_waitlist and status in ('open', 'accepted')
      );
$$;

-- Give the first person in line a request, for each of an owner's copies
-- that is free. Runs after anything that might free a copy or a limit.
create function public.promote_for_owner(p_owner uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  c record;
  e record;
begin
  if (select lending_paused from public.members where id = p_owner) then return; end if;
  for c in
    select id from public.copies
    where owner_id = p_owner and removed_at is null and not on_loan
    order by added_at
  loop
    if public.limit_reason(p_owner, null) = 'limit_total' then return; end if;
    continue when exists (
      select 1 from public.requests
      where copy_id = c.id and from_waitlist and status in ('open', 'accepted')
    );
    for e in
      select id, member_id from public.waitlist
      where copy_id = c.id and status = 'waiting'
      order by joined_at
    loop
      if public.limit_reason(p_owner, e.member_id) is null then
        update public.waitlist set status = 'promoted', closed_at = now() where id = e.id;
        insert into public.requests (copy_id, requester_id, from_waitlist)
          values (c.id, e.member_id, true)
          on conflict do nothing;
        exit;
      end if;
    end loop;
  end loop;
end;
$$;

-- Ask to borrow a copy, or join its waitlist when it can't be lent now.
-- Returns 'requested', or 'waitlisted' followed by the reason.
drop function public.request_copy(uuid);
create function public.request_copy(p_copy uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := public.require_member();
  c record;
  why text;
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

  if exists (
    select 1 from public.requests
    where copy_id = p_copy and requester_id = me and status in ('open', 'accepted')
  ) then
    return 'requested';
  end if;
  if exists (
    select 1 from public.loans where copy_id = p_copy and borrower_id = me and returned_at is null
  ) then
    raise exception 'already_borrowing';
  end if;
  select reason into why from public.waitlist
    where copy_id = p_copy and member_id = me and status = 'waiting';
  if why is not null then return 'waitlisted:' || why; end if;

  why := case
    when c.on_loan then 'lent_out'
    when public.has_line(p_copy) then 'line'
    else public.limit_reason(c.owner_id, me)
  end;
  if why is not null then
    insert into public.waitlist (copy_id, member_id, reason) values (p_copy, me, why);
    return 'waitlisted:' || why;
  end if;

  insert into public.requests (copy_id, requester_id) values (p_copy, me);
  return 'requested';
end;
$$;

create function public.leave_waitlist(p_entry uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := public.require_member();
begin
  update public.waitlist set status = 'left', closed_at = now()
    where id = p_entry and member_id = me and status = 'waiting';
end;
$$;

-- When a request ends without a loan, the next person in line gets a turn.
create or replace function public.cancel_request(p_request uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := public.require_member();
  v_owner uuid;
begin
  update public.requests r set status = 'cancelled', closed_at = now()
    from public.copies c
    where r.id = p_request and c.id = r.copy_id and r.requester_id = me
      and r.status in ('open', 'accepted')
    returning c.owner_id into v_owner;
  if v_owner is not null then perform public.promote_for_owner(v_owner); end if;
end;
$$;

create or replace function public.decline_request(p_request uuid)
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
  if found then perform public.promote_for_owner(me); end if;
end;
$$;

-- Lending a copy moves everyone else who asked for it onto its waitlist, in
-- the order they asked.
create or replace function public.mark_lent(p_request uuid)
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

  insert into public.waitlist (copy_id, member_id, joined_at, reason)
    select copy_id, requester_id, created_at, 'lent_out' from public.requests
    where copy_id = r.copy_id and status in ('open', 'accepted') and id <> r.id
    on conflict do nothing;
  update public.requests set status = 'waitlisted', closed_at = now()
    where copy_id = r.copy_id and status in ('open', 'accepted') and id <> r.id;
  -- The borrower is no longer waiting for this copy.
  update public.waitlist set status = 'promoted', closed_at = now()
    where copy_id = r.copy_id and member_id = r.requester_id and status = 'waiting';
end;
$$;

create or replace function public.mark_returned(p_loan uuid)
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
  perform public.promote_for_owner(me);
end;
$$;

-- Removing a book also takes it off everyone's waitlists.
create or replace function public.remove_copy(p_copy uuid)
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
    update public.waitlist set status = 'removed', closed_at = now()
      where copy_id = p_copy and status = 'waiting';
  end if;
end;
$$;

-- The borrower still needs the book: the reminder clock starts again.
create function public.still_need_it(p_loan uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := public.require_member();
begin
  update public.loans set reminder_from = now(), reminder_sent_at = null
    where id = p_loan and borrower_id = me and returned_at is null;
end;
$$;

-- After an owner changes their limits or turns pausing off.
create function public.refresh_my_waitlists()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := public.require_member();
begin
  perform public.promote_for_owner(me);
end;
$$;

-- How many people are waiting for each copy. Anyone approved may know the
-- number, not the names.
create function public.waiting_counts(p_copies uuid[])
returns table (copy_id uuid, waiting integer)
language sql stable security definer set search_path = ''
as $$
  select w.copy_id, count(*)::integer
  from public.waitlist w
  where public.is_approved() and w.copy_id = any (p_copies) and w.status = 'waiting'
  group by w.copy_id;
$$;

-- My places in line.
create function public.my_waitlists()
returns table (entry_id uuid, copy_id uuid, place integer, reason text)
language sql stable security definer set search_path = ''
as $$
  select w.id, w.copy_id,
    1 + (
      select count(*)::integer from public.waitlist o
      where o.copy_id = w.copy_id and o.status = 'waiting' and o.joined_at < w.joined_at
    ),
    w.reason
  from public.waitlist w
  where w.member_id = auth.uid() and w.status = 'waiting';
$$;

revoke all on function
  public.limit_reason(uuid, uuid), public.has_line(uuid), public.promote_for_owner(uuid),
  public.request_copy(uuid), public.leave_waitlist(uuid), public.still_need_it(uuid),
  public.refresh_my_waitlists(), public.waiting_counts(uuid[]), public.my_waitlists()
  from public, anon;
grant execute on function
  public.request_copy(uuid), public.leave_waitlist(uuid), public.still_need_it(uuid),
  public.refresh_my_waitlists(), public.waiting_counts(uuid[]), public.my_waitlists()
  to authenticated;

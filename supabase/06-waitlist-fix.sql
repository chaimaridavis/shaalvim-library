-- Fix: when a copy is on the shelf but someone is waiting for it only because
-- of their own lending limit, the next person may borrow it straight away.
-- Run once in Supabase: SQL Editor > New query > paste this whole file > Run.

create or replace function public.request_copy(p_copy uuid)
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
  if why is null then
    insert into public.requests (copy_id, requester_id) values (p_copy, me);
    return 'requested';
  end if;

  insert into public.waitlist (copy_id, member_id, reason) values (p_copy, me, why);
  -- The copy is on the shelf: give the turn to the first person in line who
  -- is allowed to borrow it, which may be me.
  if not c.on_loan then
    perform public.promote_for_owner(c.owner_id);
    if exists (
      select 1 from public.requests
      where copy_id = p_copy and requester_id = me and status in ('open', 'accepted')
    ) then
      return 'requested';
    end if;
  end if;
  return 'waitlisted:' || why;
end;
$$;

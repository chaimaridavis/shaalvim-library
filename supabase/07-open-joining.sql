-- Open joining: no approval step. Members need 5 books on their shelf to ask
-- to borrow, every owner accepts a request before sharing a WhatsApp number,
-- and the administrator can remove members.
-- Run once in Supabase: SQL Editor > New query > paste this whole file > Run.

-- Everyone who joins is a member straight away, including anyone waiting.
update public.members set status = 'approved', approved_at = coalesce(approved_at, now())
  where status = 'pending';
alter table public.members alter column status set default 'approved';

-- Contact details: always the WhatsApp number, and only between the two
-- people in a request the owner has accepted (an owner sees whoever asked).
create or replace function public.get_contact(target uuid)
returns table (kind text, value text)
language sql stable security definer set search_path = ''
as $$
  select 'whatsapp', c.whatsapp
  from public.members m
  join public.member_contacts c on c.member_id = m.id
  where m.id = target
    and m.status = 'approved'
    and public.is_approved()
    and (
      m.id = auth.uid()
      or exists (
        select 1 from public.requests r join public.copies cp on cp.id = r.copy_id
        where r.requester_id = auth.uid() and cp.owner_id = target
          and r.status in ('accepted', 'lent')
      )
      or exists (
        select 1 from public.requests r join public.copies cp on cp.id = r.copy_id
        where r.requester_id = target and cp.owner_id = auth.uid()
          and r.status in ('open', 'accepted', 'lent')
      )
    );
$$;

-- How many books a member needs on their shelf before asking to borrow.
create function public.min_books_to_borrow()
returns integer
language sql immutable
as $$ select 5 $$;

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
  if (select count(*) from public.copies where owner_id = me and removed_at is null)
      < public.min_books_to_borrow() then
    raise exception 'need_books';
  end if;

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

-- Before the administrator removes a member: books that member has borrowed
-- go back on their owners' shelves, so nobody's copy stays "lent out".
-- The site then deletes the account, which removes the member's books,
-- requests and waitlist places.
create function public.prepare_member_removal(p_member uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  l record;
  owners uuid[];
  o uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_member = auth.uid() then raise exception 'not_yourself'; end if;
  update public.waitlist set status = 'removed', closed_at = now()
    where member_id = p_member and status = 'waiting';
  -- Their requests end; if one was a waitlist turn, the next person gets it.
  select array_agg(distinct cp.owner_id) into owners
    from public.requests r join public.copies cp on cp.id = r.copy_id
    where r.requester_id = p_member and r.status in ('open', 'accepted');
  update public.requests set status = 'cancelled', closed_at = now()
    where requester_id = p_member and status in ('open', 'accepted');
  foreach o in array coalesce(owners, '{}') loop
    perform public.promote_for_owner(o);
  end loop;
  for l in
    select ln.id, ln.copy_id, cp.owner_id from public.loans ln
    join public.copies cp on cp.id = ln.copy_id
    where ln.borrower_id = p_member and ln.returned_at is null
  loop
    update public.loans set returned_at = now() where id = l.id;
    update public.copies set on_loan = false where id = l.copy_id;
    perform public.promote_for_owner(l.owner_id);
  end loop;
end;
$$;

revoke all on function public.prepare_member_removal(uuid) from public, anon;
grant execute on function public.prepare_member_removal(uuid) to authenticated;

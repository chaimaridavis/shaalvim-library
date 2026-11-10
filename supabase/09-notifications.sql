-- Notifications: the bell. Each member sees what happened to their books,
-- requests and waitlist places. Created automatically when things change.
-- Run once in Supabase: SQL Editor > New query > paste this whole file > Run.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  message text not null,
  link text not null default '/loans',
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_member on public.notifications (member_id, created_at desc);

alter table public.notifications enable row level security;

create policy "members see their own notifications"
  on public.notifications for select to authenticated
  using (member_id = auth.uid());

create policy "members mark their own notifications read"
  on public.notifications for update to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create function public.notify(p_member uuid, p_message text, p_link text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (member_id, message, link) values (p_member, p_message, p_link);
$$;

revoke all on function public.notify(uuid, text, text) from public, anon, authenticated;

-- Requests: asked, accepted, declined, cancelled, moved to the waitlist.
create function public.notify_on_request()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid;
  owner_name text;
  asker_name text;
  title text;
  book_id uuid;
  removed boolean;
begin
  select cp.owner_id, o.full_name, b.title, b.id, cp.removed_at is not null
    into owner_id, owner_name, title, book_id, removed
    from public.copies cp
    join public.members o on o.id = cp.owner_id
    join public.books b on b.id = cp.book_id
    where cp.id = new.copy_id;
  select full_name into asker_name from public.members where id = new.requester_id;

  if tg_op = 'INSERT' then
    if new.from_waitlist then
      perform public.notify(owner_id, asker_name || ' is next in line for ' || title || ' and has been sent a request.', '/loans');
      perform public.notify(new.requester_id, 'It''s your turn for ' || title || '. We''ve asked ' || owner_name || ' for you.', '/books/' || book_id);
    else
      perform public.notify(owner_id, asker_name || ' asked to borrow ' || title || '.', '/loans');
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' then
      perform public.notify(new.requester_id, owner_name || ' accepted your request for ' || title || '. You can now message them on WhatsApp.', '/books/' || book_id);
    elsif new.status = 'declined' then
      perform public.notify(new.requester_id, owner_name || ' declined your request for ' || title || '.', '/books/' || book_id);
    elsif new.status = 'waitlisted' then
      perform public.notify(new.requester_id, title || ' was lent to someone else, so you''re on the waitlist for it.', '/books/' || book_id);
    elsif new.status = 'cancelled' and not removed then
      perform public.notify(owner_id, asker_name || ' cancelled their request for ' || title || '.', '/loans');
    end if;
  end if;
  return new;
end;
$$;

create trigger requests_notify
  after insert or update of status on public.requests
  for each row execute function public.notify_on_request();

-- Waitlists: whoever has the book hears that someone is waiting for it.
create function public.notify_on_waitlist()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  borrower uuid;
  title text;
begin
  select l.borrower_id, b.title into borrower, title
    from public.loans l
    join public.copies cp on cp.id = l.copy_id
    join public.books b on b.id = cp.book_id
    where l.copy_id = new.copy_id and l.returned_at is null;
  if borrower is not null and borrower <> new.member_id then
    perform public.notify(borrower, 'Someone is waiting for ' || title || ', which you have.', '/loans');
  end if;
  return new;
end;
$$;

create trigger waitlist_notify
  after insert on public.waitlist
  for each row execute function public.notify_on_waitlist();

-- Loans: the borrower says they still need it.
create function public.notify_on_loan()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid;
  borrower_name text;
  title text;
begin
  if new.returned_at is null and new.reminder_from > old.reminder_from then
    select cp.owner_id, b.title into owner_id, title
      from public.copies cp join public.books b on b.id = cp.book_id
      where cp.id = new.copy_id;
    select full_name into borrower_name from public.members where id = new.borrower_id;
    perform public.notify(owner_id, borrower_name || ' still needs ' || title || ' a little longer.', '/loans');
  end if;
  return new;
end;
$$;

create trigger loans_notify
  after update of reminder_from on public.loans
  for each row execute function public.notify_on_loan();

-- Removing a book tells everyone who asked for it or was waiting for it.
create function public.notify_on_copy_removed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  owner_name text;
  title text;
  m uuid;
begin
  if new.removed_at is not null and old.removed_at is null then
    select o.full_name, b.title into owner_name, title
      from public.members o, public.books b
      where o.id = new.owner_id and b.id = new.book_id;
    for m in
      select requester_id from public.requests
        where copy_id = new.id and status in ('open', 'accepted')
      union
      select member_id from public.waitlist where copy_id = new.id and status = 'waiting'
    loop
      perform public.notify(m, owner_name || ' removed ' || title || ' from their shelf, so your request or waitlist place has ended.', '/loans');
    end loop;
  end if;
  return new;
end;
$$;

create trigger copies_notify_removed
  after update of removed_at on public.copies
  for each row execute function public.notify_on_copy_removed();

revoke all on function
  public.notify_on_request(), public.notify_on_waitlist(), public.notify_on_loan(),
  public.notify_on_copy_removed()
  from public, anon, authenticated;

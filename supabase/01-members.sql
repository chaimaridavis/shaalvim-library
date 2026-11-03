-- Stage 1: members, approvals and contact details.
-- Run once in Supabase: SQL Editor > New query > paste this whole file > Run.

create type public.member_status as enum ('pending', 'approved');
create type public.contact_setting as enum ('whatsapp_any', 'whatsapp_after_accept', 'email_only');
create type public.reminder_after as enum ('two_weeks', 'one_month', 'two_months', 'never');

-- One row per person who has asked to join. Readable by approved members.
create table public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 100),
  status public.member_status not null default 'pending',
  is_admin boolean not null default false,
  contact_setting public.contact_setting not null default 'whatsapp_any',
  max_lent_at_once integer check (max_lent_at_once > 0),
  max_per_borrower integer check (max_per_borrower > 0),
  reminder_after public.reminder_after not null default 'one_month',
  lending_paused boolean not null default false,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

-- Private contact details, kept apart so other members can only reach them
-- through get_contact(), which applies each member's contact setting.
create table public.member_contacts (
  member_id uuid primary key references public.members (id) on delete cascade,
  email text not null,
  whatsapp text not null check (char_length(whatsapp) between 7 and 20)
);

create function public.is_approved()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members where id = auth.uid() and status = 'approved'
  );
$$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members
    where id = auth.uid() and status = 'approved' and is_admin
  );
$$;

alter table public.members enable row level security;
alter table public.member_contacts enable row level security;

-- Members: you always see yourself; approved members see other approved
-- members; the administrator sees everyone, including people waiting.
create policy "members are visible to approved members"
  on public.members for select to authenticated
  using (
    id = auth.uid()
    or (status = 'approved' and public.is_approved())
    or public.is_admin()
  );

create policy "members update their own row"
  on public.members for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Contact details: only yourself and the administrator read the table directly.
create policy "contacts are visible to self and administrator"
  on public.member_contacts for select to authenticated
  using (member_id = auth.uid() or public.is_admin());

create policy "members update their own contacts"
  on public.member_contacts for update to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

-- Members may change only their own settings, never their status or role.
-- New rows are created by the site's server, not by members directly.
revoke all on public.members, public.member_contacts from anon, authenticated;
grant select on public.members, public.member_contacts to authenticated;
grant update (full_name, contact_setting, max_lent_at_once, max_per_borrower,
              reminder_after, lending_paused)
  on public.members to authenticated;
grant update (whatsapp) on public.member_contacts to authenticated;

-- What one approved member may see of another's contact details.
-- Returns nothing, or one row: kind is 'whatsapp' or 'email'.
-- Stage 3 extends this for "WhatsApp after I accept a request" and for owners
-- seeing the people who asked for their books.
create function public.get_contact(target uuid)
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
    and (m.id = auth.uid() or m.contact_setting <> 'whatsapp_after_accept');
$$;

revoke all on function public.get_contact(uuid) from public, anon;
grant execute on function public.get_contact(uuid) to authenticated;

-- Keep the stored email in step when a member confirms a new address.
create function public.sync_member_email()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.member_contacts set email = new.email where member_id = new.id;
  return new;
end;
$$;

create trigger on_auth_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.sync_member_email();

-- Stage 2: books and the copies members own.
-- Run once in Supabase: SQL Editor > New query > paste this whole file > Run.

create type public.book_category as enum ('childrens', 'fiction', 'nonfiction');

-- One row per book (not per copy), with what the catalog told us, so each
-- book is looked up only once and several members' copies share it.
create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 300),
  author text not null default '' check (char_length(author) <= 300),
  first_published integer check (first_published between 0 and 2100),
  category public.book_category,
  cover_url text check (cover_url like 'https://%'),
  source text not null check (source in ('openlibrary', 'google')),
  source_id text not null,
  -- Lower-case title and author with only letters and digits, for matching
  -- pasted lines against books already in the library.
  match_key text not null,
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

create index books_match_key on public.books (match_key);

-- One row per physical copy on a member's shelf. Removing a book sets
-- removed_at instead of deleting it, so a lent-out copy's loan can be kept.
create table public.copies (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id),
  owner_id uuid not null references public.members (id) on delete cascade,
  added_at timestamptz not null default now(),
  removed_at timestamptz
);

create index copies_owner on public.copies (owner_id) where removed_at is null;
create index copies_book on public.copies (book_id) where removed_at is null;

alter table public.books enable row level security;
alter table public.copies enable row level security;

create policy "books are visible to approved members"
  on public.books for select to authenticated
  using (public.is_approved());

-- Copies: approved members see the shelves of other approved members.
create policy "copies are visible to approved members"
  on public.copies for select to authenticated
  using (
    public.is_approved()
    and exists (
      select 1 from public.members m
      where m.id = owner_id and m.status = 'approved'
    )
  );

create policy "members add copies to their own shelf"
  on public.copies for insert to authenticated
  with check (owner_id = auth.uid() and public.is_approved());

create policy "members remove copies from their own shelf"
  on public.copies for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Books are created by the site's server after a catalog lookup.
revoke all on public.books, public.copies from anon, authenticated;
grant select on public.books, public.copies to authenticated;
grant insert (book_id, owner_id) on public.copies to authenticated;
grant update (removed_at) on public.copies to authenticated;

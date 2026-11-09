-- Genres: one per book, from a fixed list.
-- Run once in Supabase: SQL Editor > New query > paste this whole file > Run.

alter table public.books add column genre text check (genre in (
  'fantasy', 'science_fiction', 'mystery_thriller', 'historical_fiction', 'classics',
  'adventure', 'romance', 'humor', 'general_fiction',
  'biography_memoir', 'history', 'holocaust', 'jewish_interest', 'business_money',
  'self_help_psychology', 'science_ideas', 'hobbies_howto'
));

-- Anyone who has the book on their shelf may correct its genre. Books are
-- shared between members, so the change shows for every copy.
create function public.set_book_genre(p_book uuid, p_genre text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := public.require_member();
begin
  if not exists (
    select 1 from public.copies where book_id = p_book and owner_id = me and removed_at is null
  ) then
    raise exception 'not_your_book';
  end if;
  update public.books set genre = nullif(p_genre, '') where id = p_book;
end;
$$;

revoke all on function public.set_book_genre(uuid, text) from public, anon;
grant execute on function public.set_book_genre(uuid, text) to authenticated;

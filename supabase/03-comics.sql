-- Adds "Comics" as a fourth kind of book.
-- Run once in Supabase: SQL Editor > New query > paste this whole file > Run.

alter type public.book_category add value if not exists 'comics';

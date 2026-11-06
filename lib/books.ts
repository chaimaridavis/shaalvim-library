import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/catalog";

export type Book = {
  id: string;
  title: string;
  author: string;
  first_published: number | null;
  category: Category | null;
  cover_url: string | null;
};

// Stage 3 adds "lent" once loans exist.
export type CopyStatus = "available" | "paused";

export type Copy = {
  id: string;
  added_at: string;
  book: Book;
  owner: { id: string; full_name: string };
  status: CopyStatus;
};

type CopyRow = {
  id: string;
  added_at: string;
  books: Book;
  members: { id: string; full_name: string; lending_paused: boolean };
};

// Every copy on approved members' shelves, optionally only one member's.
export async function loadCopies(ownerId?: string): Promise<Copy[]> {
  const supabase = await createClient();
  let query = supabase
    .from("copies")
    .select(
      "id, added_at, books(id, title, author, first_published, category, cover_url), members(id, full_name, lending_paused)",
    )
    .is("removed_at", null)
    .order("added_at", { ascending: false });
  if (ownerId) query = query.eq("owner_id", ownerId);

  const { data, error } = await query.overrideTypes<CopyRow[], { merge: false }>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    added_at: row.added_at,
    book: row.books,
    owner: { id: row.members.id, full_name: row.members.full_name },
    status: row.members.lending_paused ? "paused" : "available",
  }));
}

export const statusLabel: Record<CopyStatus, string> = {
  available: "Available",
  paused: "Not lending right now",
};

// One entry per book, so several members' copies show once.
export type Title = { book: Book; copies: Copy[] };

export function groupByBook(copies: Copy[]): Title[] {
  const byBook = new Map<string, Title>();
  for (const copy of copies) {
    const entry = byBook.get(copy.book.id) ?? { book: copy.book, copies: [] };
    entry.copies.push(copy);
    byBook.set(copy.book.id, entry);
  }
  return [...byBook.values()];
}

// Alphabetical order the way a library shelves books: "The Hobbit" under H.
export function byTitle(a: { title: string }, b: { title: string }): number {
  const key = (t: string) => t.replace(/^(the|a|an)\s+/i, "");
  return key(a.title).localeCompare(key(b.title));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedMember } from "@/lib/auth";
import {
  matchKey,
  matchLine,
  splitLine,
  type CatalogBook,
  type Category,
  type LineMatch,
} from "@/lib/catalog";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const maxLines = 60;
const categories: Category[] = ["childrens", "fiction", "nonfiction", "comics"];
const coverHosts = ["covers.openlibrary.org", "books.google.com", "books.googleusercontent.com"];

export type FoundList = { matches: LineMatch[]; tooMany?: boolean };

// Books already in the library are matched without asking the catalog again.
async function matchFromLibrary(line: string): Promise<LineMatch | null> {
  const { title, author } = splitLine(line);
  const [titleKey, authorKey] = matchKey(title, author).split("|");
  if (!titleKey) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("books")
    .select("source, source_id, title, author, first_published, category, cover_url, match_key")
    .like("match_key", `${titleKey}|%`)
    .limit(5);
  // Compare the end of the author, roughly the surname, so "Dahl" and
  // "Roald Dahl" both match.
  const hit = (data ?? []).find(
    (b) => !authorKey || b.match_key.split("|")[1].includes(authorKey.slice(-5)),
  );
  if (!hit) return null;
  return {
    line,
    title,
    confident: true,
    book: {
      source: hit.source,
      sourceId: hit.source_id,
      title: hit.title,
      author: hit.author,
      firstPublished: hit.first_published,
      category: hit.category,
      coverUrl: hit.cover_url,
    },
  };
}

export async function findList(text: string): Promise<FoundList> {
  await requireApprovedMember();
  const lines = [...new Set(text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 1))];
  const wanted = lines.slice(0, maxLines);

  // A few at a time, to be polite to the free catalog.
  const matches: LineMatch[] = new Array(wanted.length);
  let next = 0;
  async function worker() {
    while (next < wanted.length) {
      const i = next++;
      const line = wanted[i];
      matches[i] =
        (await matchFromLibrary(line)) ??
        (await matchLine(line).catch(() => ({ line, title: splitLine(line).title, book: null, confident: false })));
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { matches, tooMany: lines.length > maxLines };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function isCatalogBook(value: unknown): value is CatalogBook {
  const b = value as CatalogBook;
  return (
    typeof b === "object" &&
    b !== null &&
    (b.source === "openlibrary" || b.source === "google") &&
    typeof b.sourceId === "string" &&
    b.sourceId.length <= 100 &&
    typeof b.title === "string" &&
    b.title.trim().length > 0 &&
    b.title.length <= 300 &&
    typeof b.author === "string" &&
    b.author.length <= 300 &&
    (b.firstPublished === null || Number.isInteger(b.firstPublished)) &&
    (b.category === null || categories.includes(b.category)) &&
    (b.coverUrl === null ||
      (typeof b.coverUrl === "string" && coverHosts.includes(hostOf(b.coverUrl))))
  );
}

export type AddResult = { added: number; alreadyOnShelf: number; error?: string };

export async function addBooks(
  items: { book: CatalogBook; category: Category | null }[],
): Promise<AddResult> {
  const member = await requireApprovedMember();
  const valid = items
    .slice(0, maxLines)
    .filter((item) => isCatalogBook(item.book))
    .map((item) => ({
      ...item.book,
      category: categories.includes(item.category as Category) ? item.category : item.book.category,
    }));
  if (!valid.length) return { added: 0, alreadyOnShelf: 0, error: "Nothing to add." };

  // Save each book once for the whole library.
  const admin = createAdminClient();
  const { error } = await admin
    .from("books")
    .upsert(
      valid.map((b) => ({
        source: b.source,
        source_id: b.sourceId,
        title: b.title.trim(),
        author: b.author.trim(),
        first_published:
          b.firstPublished && b.firstPublished > 0 && b.firstPublished <= 2100 ? b.firstPublished : null,
        category: b.category,
        cover_url: b.coverUrl,
        match_key: matchKey(b.title, b.author),
      })),
      { onConflict: "source,source_id", ignoreDuplicates: true },
    );
  if (error) {
    console.error("saving books failed", error);
    return { added: 0, alreadyOnShelf: 0, error: "Something went wrong. Please try again." };
  }

  // Look the books up again to get their ids, new and existing alike.
  const { data: books } = await admin
    .from("books")
    .select("id, source, source_id, category")
    .in("source_id", valid.map((b) => b.sourceId));
  const idFor = new Map((books ?? []).map((b) => [`${b.source}:${b.source_id}`, b]));

  // Fill in a missing category the member chose.
  for (const b of valid) {
    const row = idFor.get(`${b.source}:${b.sourceId}`);
    if (row && !row.category && b.category) {
      await admin.from("books").update({ category: b.category }).eq("id", row.id).is("category", null);
    }
  }

  const supabase = await createClient();
  const { data: owned } = await supabase
    .from("copies")
    .select("book_id")
    .eq("owner_id", member.id)
    .is("removed_at", null);
  const ownedIds = new Set((owned ?? []).map((c) => c.book_id));
  const bookIds = [
    ...new Set(valid.map((b) => idFor.get(`${b.source}:${b.sourceId}`)?.id).filter(Boolean)),
  ] as string[];
  const newIds = bookIds.filter((id) => !ownedIds.has(id));

  if (newIds.length) {
    const { error: copyError } = await supabase
      .from("copies")
      .insert(newIds.map((book_id) => ({ book_id, owner_id: member.id })));
    if (copyError) {
      console.error("adding copies failed", copyError);
      return { added: 0, alreadyOnShelf: 0, error: "Something went wrong. Please try again." };
    }
  }

  revalidatePath("/", "layout");
  return { added: newIds.length, alreadyOnShelf: bookIds.length - newIds.length };
}

// Also cancels open requests for the copy; a loan stays until it's returned.
export async function removeCopy(copyId: string) {
  await requireApprovedMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_copy", { p_copy: copyId });
  if (error) throw error;
  revalidatePath("/", "layout");
}

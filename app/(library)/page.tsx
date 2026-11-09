import { Suspense } from "react";
import { requireApprovedMember } from "@/lib/auth";
import { byTitle, groupByBook, loadCopies, titleStatus, type Title } from "@/lib/books";
import { genres, isGenre } from "@/lib/genres";
import { BookGrid, type GridItem } from "./book-grid";
import { BrowseControls } from "./browse-controls";

const kindNames: Record<string, string> = {
  childrens: "children's",
  fiction: "fiction",
  nonfiction: "non-fiction",
  comics: "comics",
};

const plain = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, "");

function gridItem(title: Title, memberId: string): GridItem {
  const { book, copies } = title;
  const mine = copies.every((c) => c.owner.id === memberId);
  const lines = [book.author];
  lines.push(copies.length > 1 ? `${copies.length} copies` : mine ? "Yours" : copies[0].owner.full_name);
  const status = titleStatus(copies, memberId);
  return { bookId: book.id, title: book.title, author: book.author, coverUrl: book.cover_url, lines, status };
}

export default async function BrowsePage({ searchParams }: PageProps<"/">) {
  const member = await requireApprovedMember();
  const { q, kind, now, genre: genreParam, sort } = await searchParams;
  const genre = isGenre(genreParam) ? genreParam : null;
  const query = typeof q === "string" ? plain(q).trim() : "";
  const category = typeof kind === "string" && kindNames[kind] ? kind : "";

  let titles = groupByBook(await loadCopies());
  const libraryIsEmpty = titles.length === 0;
  if (query) {
    const words = query.split(/\s+/);
    titles = titles.filter((t) => {
      const haystack = plain(`${t.book.title} ${t.book.author}`);
      return words.every((w) => haystack.includes(w));
    });
  }
  if (category) titles = titles.filter((t) => t.book.category === category);
  if (genre) titles = titles.filter((t) => t.book.genre === genre);
  if (now === "1") {
    titles = titles.filter((t) =>
      t.copies.some((c) => c.owner.id !== member.id && c.status === "available"),
    );
  }
  // Authors by surname; recently added by the newest copy of each book.
  const surname = (author: string) => author.trim().split(/\s+/).pop() ?? "";
  const newest = (t: Title) => t.copies.reduce((m, c) => (c.added_at > m ? c.added_at : m), "");
  titles.sort(
    sort === "author"
      ? (a, b) => surname(a.book.author).localeCompare(surname(b.book.author)) || byTitle(a.book, b.book)
      : sort === "recent"
        ? (a, b) => newest(b).localeCompare(newest(a)) || byTitle(a.book, b.book)
        : (a, b) => byTitle(a.book, b.book),
  );

  let empty = "";
  if (libraryIsEmpty) empty = "No books on the shelves yet. Add yours from My books.";
  else if (!titles.length) {
    const what = [category && kindNames[category], genre && genres[genre].toLowerCase(), "books"]
      .filter(Boolean)
      .join(" ");
    const matching = query ? ` matching “${typeof q === "string" ? q.trim() : ""}”` : "";
    const available = now === "1" ? " that you can borrow now" : "";
    empty = `There are no ${what}${matching}${available}.`;
  }

  return (
    <div>
      <div className="title-row">
        <h1>Shaalvim Library</h1>
        <span className="muted">English books</span>
      </div>
      <div style={{ marginTop: 20 }}>
        <Suspense>
          <BrowseControls />
        </Suspense>
      </div>
      <div style={{ marginTop: 24 }}>
        {empty ? <p>{empty}</p> : <BookGrid items={titles.map((t) => gridItem(t, member.id))} />}
      </div>
    </div>
  );
}

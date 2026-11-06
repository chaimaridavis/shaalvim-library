import { Suspense } from "react";
import { requireApprovedMember } from "@/lib/auth";
import { byTitle, groupByBook, loadCopies, statusLabel, type Title } from "@/lib/books";
import { BookGrid, type GridItem } from "./book-grid";
import { BrowseControls } from "./browse-controls";

const kindNames: Record<string, string> = {
  childrens: "children's",
  fiction: "fiction",
  nonfiction: "non-fiction",
};

const plain = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, "");

function gridItem(title: Title, memberId: string): GridItem {
  const { book, copies } = title;
  const borrowable = copies.filter((c) => c.owner.id !== memberId && c.status === "available");
  const mine = copies.every((c) => c.owner.id === memberId);
  const lines = [book.author];
  lines.push(copies.length > 1 ? `${copies.length} copies` : mine ? "Yours" : copies[0].owner.full_name);

  const status: GridItem["status"] = mine
    ? { text: "On your shelf", tone: "muted" }
    : borrowable.length
      ? { text: statusLabel.available, tone: "available" }
      : { text: statusLabel.paused, tone: "warning" };
  return { bookId: book.id, title: book.title, author: book.author, coverUrl: book.cover_url, lines, status };
}

export default async function BrowsePage({ searchParams }: PageProps<"/">) {
  const member = await requireApprovedMember();
  const { q, kind, now } = await searchParams;
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
  if (now === "1") {
    titles = titles.filter((t) =>
      t.copies.some((c) => c.owner.id !== member.id && c.status === "available"),
    );
  }
  titles.sort((a, b) => byTitle(a.book, b.book));

  let empty = "";
  if (libraryIsEmpty) empty = "No books on the shelves yet. Add yours from My books.";
  else if (!titles.length) {
    const what = category ? `${kindNames[category]} books` : "books";
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

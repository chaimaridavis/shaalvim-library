import { requireApprovedMember } from "@/lib/auth";
import { byTitle, loadCopies, statusLabel } from "@/lib/books";
import { AddOne } from "./add-one";
import { PasteList } from "./paste-list";
import { Shelf } from "./shelf";

export default async function MyBooksPage() {
  const member = await requireApprovedMember();
  const copies = (await loadCopies(member.id)).sort((a, b) => byTitle(a.book, b.book));

  return (
    <div>
      <h1>My books</h1>
      <p className="muted" style={{ marginTop: 6 }}>
        You have {copies.length} {copies.length === 1 ? "book" : "books"} on your shelf.
      </p>

      <div className="card" style={{ marginTop: 20 }}>
        <AddOne />
        <hr className="divider" />
        <PasteList />
      </div>

      <h2 style={{ marginTop: 32 }}>Your shelf</h2>
      <div style={{ marginTop: 8 }}>
        <Shelf
          items={copies.map((c) => ({
            copyId: c.id,
            title: c.book.title,
            author: c.book.author,
            coverUrl: c.book.cover_url,
            statusText: c.status === "available" ? "On your shelf" : statusLabel[c.status],
            warning: false,
          }))}
        />
      </div>
    </div>
  );
}

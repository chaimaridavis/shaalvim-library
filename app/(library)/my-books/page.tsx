import { requireApprovedMember } from "@/lib/auth";
import { byTitle, loadCopies, minBooksToBorrow, statusLabel } from "@/lib/books";
import { AddOne } from "./add-one";
import { PasteList } from "./paste-list";
import { Shelf } from "./shelf";

export default async function MyBooksPage({ searchParams }: PageProps<"/my-books">) {
  const member = await requireApprovedMember();
  const copies = (await loadCopies(member.id)).sort((a, b) => byTitle(a.book, b.book));

  return (
    <div>
      <h1>My books</h1>
      <p className="muted" style={{ marginTop: 6 }}>
        You have {copies.length} {copies.length === 1 ? "book" : "books"} on your shelf.
      </p>
      {copies.length < minBooksToBorrow && (
        <p className="notice" style={{ marginTop: 16 }}>
          {(await searchParams).welcome ? "Welcome to the library! " : ""}
          Add at least {minBooksToBorrow} of your own books to start borrowing other
          members&rsquo; books.
          {copies.length > 0 && ` ${minBooksToBorrow - copies.length} to go.`}
        </p>
      )}

      <div className="two-columns">
        <div className="card" style={{ marginTop: 20 }}>
          <AddOne />
          <hr className="divider" />
          <PasteList />
        </div>

        <div>
          <h2 className="shelf-heading">Your shelf</h2>
          <div style={{ marginTop: 8 }}>
            <Shelf
          items={copies.map((c) => ({
            copyId: c.id,
            title: c.book.title,
            author: c.book.author,
            coverUrl: c.book.cover_url,
            statusText: c.status === "available" ? "On your shelf" : statusLabel[c.status],
            warning: c.status === "lent",
          }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

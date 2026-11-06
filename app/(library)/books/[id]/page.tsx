import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedMember } from "@/lib/auth";
import { firstName, initials, loadCopies, statusLabel, type Copy } from "@/lib/books";
import { Cover } from "../../../cover";
import { BackLink } from "../../back-link";

const plural = (n: number) => `${n} ${n === 1 ? "book" : "books"}`;

export default async function BookPage({ params }: PageProps<"/books/[id]">) {
  const member = await requireApprovedMember();
  const { id } = await params;

  const all = await loadCopies();
  const copies = all.filter((c) => c.book.id === id);
  if (!copies.length) notFound();
  const book = copies[0].book;

  const shelfSize = new Map<string, number>();
  for (const c of all) shelfSize.set(c.owner.id, (shelfSize.get(c.owner.id) ?? 0) + 1);

  // The copy to feature first: one the member can borrow, else any other.
  const others = copies.filter((c) => c.owner.id !== member.id);
  const featured = others.find((c) => c.status === "available") ?? others[0] ?? copies[0];
  const rest = copies.filter((c) => c !== featured);
  const isMine = (c: Copy) => c.owner.id === member.id;

  const headline = others.some((c) => c.status === "available")
    ? { text: statusLabel.available, tone: "available" }
    : others.length
      ? { text: statusLabel.paused, tone: "warning" }
      : { text: "On your shelf", tone: "muted" };

  return (
    <div>
      <BackLink label="Browse" fallback="/" />
      <div className="book-head">
        <Cover title={book.title} author={book.author} coverUrl={book.cover_url} size="large" />
        <div>
          <h1>{book.title}</h1>
          {book.author && <p className="book-author">{book.author}</p>}
          {book.first_published && (
            <p className="muted" style={{ marginTop: 6 }}>
              First published {book.first_published}
            </p>
          )}
          <p className={`status status-${headline.tone}`} style={{ marginTop: 14 }}>
            {headline.text}
          </p>
        </div>
      </div>

      <h2 className="section-label" style={{ marginTop: 32 }}>
        Owned by
      </h2>
      <Link href={`/members/${featured.owner.id}`} className="card owner-card">
        <span className="avatar">{initials(featured.owner.full_name)}</span>
        <span className="owner-text">
          <strong>{isMine(featured) ? "You" : featured.owner.full_name}</strong>
          <span className="muted">{plural(shelfSize.get(featured.owner.id) ?? 0)} on the shelf</span>
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      {!isMine(featured) && (
        <p className="muted" style={{ marginTop: 16 }}>
          {featured.status === "paused"
            ? `${firstName(featured.owner.full_name)} isn't lending right now.`
            : `Asking ${firstName(featured.owner.full_name)} to borrow it opens in the next stage of the site.`}
        </p>
      )}

      {rest.length > 0 && (
        <>
          <h2 className="section-label" style={{ marginTop: 32 }}>
            Other copies
          </h2>
          <ul className="copy-list">
            {rest.map((c) => (
              <li key={c.id}>
                <Link href={`/members/${c.owner.id}`} className="copy-row">
                  <span className="avatar small-avatar">{initials(c.owner.full_name)}</span>
                  <span className="copy-owner">{isMine(c) ? "You" : c.owner.full_name}</span>
                  <span className={`status status-${c.status === "available" ? "available" : "warning"}`}>
                    {isMine(c) ? "Yours" : statusLabel[c.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

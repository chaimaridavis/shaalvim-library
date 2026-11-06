import { notFound } from "next/navigation";
import { requireApprovedMember } from "@/lib/auth";
import { byTitle, copyTone, firstName, groupByBook, initials, loadCopies, statusLabel } from "@/lib/books";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "../../back-link";
import { BookGrid } from "../../book-grid";
import { ContactButton, getContact } from "../../contact";

export default async function MemberPage({ params }: PageProps<"/members/[id]">) {
  const viewer = await requireApprovedMember();
  const { id } = await params;
  const supabase = await createClient();

  const { data: person } = await supabase
    .from("members")
    .select("id, full_name, contact_setting")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();
  if (!person) notFound();

  const [copies, contact] = await Promise.all([loadCopies(person.id), getContact(person.id)]);
  const titles = groupByBook(copies).sort((a, b) => byTitle(a.book, b.book));
  const isMe = person.id === viewer.id;
  const name = firstName(person.full_name);
  const lentOut = copies.filter((c) => c.status === "lent").length;

  return (
    <div>
      <BackLink label="Back" fallback="/" />
      <div className="member-head">
        <span className="avatar large-avatar">{initials(person.full_name)}</span>
        <div>
          <h1>{person.full_name}</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {copies.length} {copies.length === 1 ? "book" : "books"} · {lentOut} lent out
          </p>
        </div>
      </div>

      {!isMe && contact && <ContactButton contact={contact} name={name} />}
      {!isMe && !contact && person.contact_setting === "whatsapp_after_accept" && (
        <p className="muted">
          {name} shares a WhatsApp number once they accept your request to borrow a book.
        </p>
      )}

      <h2 style={{ marginTop: 32 }}>{isMe ? "Your shelf" : `${name}’s shelf`}</h2>
      <div style={{ marginTop: 16 }}>
        {titles.length ? (
          <BookGrid
            items={titles.map(({ book, copies: c }) => ({
              bookId: book.id,
              title: book.title,
              author: book.author,
              coverUrl: book.cover_url,
              lines: [],
              status: { text: statusLabel[c[0].status], tone: copyTone(c[0].status) },
            }))}
          />
        ) : (
          <p className="muted">No books on this shelf yet.</p>
        )}
      </div>
    </div>
  );
}

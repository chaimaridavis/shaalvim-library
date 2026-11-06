import { notFound } from "next/navigation";
import { requireApprovedMember } from "@/lib/auth";
import { byTitle, firstName, groupByBook, initials, loadCopies, statusLabel } from "@/lib/books";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "../../back-link";
import { BookGrid } from "../../book-grid";

// wa.me needs the number in international form without "+" or leading 0.
function whatsAppLink(number: string) {
  let digits = number.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

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

  const [copies, contact] = await Promise.all([
    loadCopies(person.id),
    supabase.rpc("get_contact", { target: person.id }).maybeSingle<{ kind: string; value: string }>(),
  ]);
  const titles = groupByBook(copies).sort((a, b) => byTitle(a.book, b.book));
  const isMe = person.id === viewer.id;
  const name = firstName(person.full_name);
  const lentOut = 0; // Loans arrive in Stage 3.

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

      {!isMe && contact.data?.kind === "whatsapp" && (
        <>
          <a className="button full" href={whatsAppLink(contact.data.value)} target="_blank" rel="noreferrer">
            <ChatIcon /> Message on WhatsApp
          </a>
          <p className="muted small" style={{ textAlign: "center", marginTop: 8 }}>
            Only approved members can see this number.
          </p>
        </>
      )}
      {!isMe && contact.data?.kind === "email" && (
        <>
          <a className="button full" href={`mailto:${contact.data.value}`}>
            Email {name}
          </a>
          <p className="muted small" style={{ textAlign: "center", marginTop: 8 }}>
            {contact.data.value}
          </p>
        </>
      )}
      {!isMe && !contact.data && person.contact_setting === "whatsapp_after_accept" && (
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
              status:
                c[0].status === "available"
                  ? { text: statusLabel.available, tone: "available" }
                  : { text: statusLabel.paused, tone: "warning" },
            }))}
          />
        ) : (
          <p className="muted">No books on this shelf yet.</p>
        )}
      </div>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden style={{ marginRight: 10 }}>
      <path
        d="M4 19.5 5.3 16A7.5 7.5 0 1 1 8 18.7L4 19.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

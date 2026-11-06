import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedMember } from "@/lib/auth";
import {
  copyTone,
  firstName,
  initials,
  loadCopies,
  statusLabel,
  titleStatus,
  type Copy,
} from "@/lib/books";
import { createClient } from "@/lib/supabase/server";
import { myPlaces, peopleWaiting, waitingCounts, waitReasonText } from "@/lib/waitlist";
import { Cover } from "../../../cover";
import { ActionButton } from "../../action-button";
import { BackLink } from "../../back-link";
import { ContactButton, getContact } from "../../contact";
import { cancelRequest, leaveWaitlist, requestCopy } from "../../loan-actions";

const plural = (n: number) => `${n} ${n === 1 ? "book" : "books"}`;

type MyRequest = { id: string; copy_id: string; status: "open" | "accepted"; from_waitlist: boolean };

export default async function BookPage({ params }: PageProps<"/books/[id]">) {
  const member = await requireApprovedMember();
  const { id } = await params;
  const supabase = await createClient();

  const all = await loadCopies();
  const copies = all.filter((c) => c.book.id === id);
  if (!copies.length) notFound();
  const book = copies[0].book;
  const copyIds = copies.map((c) => c.id);

  const [{ data: requests }, { data: borrowing }, { data: owners }, waiting, places] = await Promise.all([
    supabase
      .from("requests")
      .select("id, copy_id, status, from_waitlist")
      .eq("requester_id", member.id)
      .in("status", ["open", "accepted"])
      .in("copy_id", copyIds)
      .overrideTypes<MyRequest[], { merge: false }>(),
    supabase
      .from("loans")
      .select("copy_id")
      .eq("borrower_id", member.id)
      .is("returned_at", null)
      .in("copy_id", copyIds),
    supabase
      .from("members")
      .select("id, contact_setting")
      .in("id", [...new Set(copies.map((c) => c.owner.id))]),
    waitingCounts(copyIds),
    myPlaces(),
  ]);
  const myRequest = requests?.[0] ?? null;
  const myPlace = places.find((p) => copyIds.includes(p.copy_id)) ?? null;
  const myLoan = borrowing?.[0] ?? null;
  const settingOf = new Map((owners ?? []).map((o) => [o.id, o.contact_setting as string]));

  const shelfSize = new Map<string, number>();
  for (const c of all) shelfSize.set(c.owner.id, (shelfSize.get(c.owner.id) ?? 0) + 1);

  // The copy to feature first: one I have, asked for or am waiting for; else
  // one I can borrow now; else any other member's.
  const isMine = (c: Copy) => c.owner.id === member.id;
  const others = copies.filter((c) => !isMine(c));
  const linedUp = (c: Copy) => (waiting.get(c.id) ?? 0) > 0;
  const featured =
    copies.find((c) => c.id === (myLoan?.copy_id ?? myRequest?.copy_id ?? myPlace?.copy_id)) ??
    others.find((c) => c.status === "available" && !linedUp(c)) ??
    others.find((c) => c.status === "available") ??
    others[0] ??
    copies[0];
  const rest = copies.filter((c) => c !== featured);
  const headline = titleStatus(copies, member.id);
  const ownerName = firstName(featured.owner.full_name);
  const ownerSetting = settingOf.get(featured.owner.id);
  const featuredWaiting = waiting.get(featured.id) ?? 0;
  const contact = myRequest || myLoan ? await getContact(featured.owner.id) : null;
  // Waiting for one copy doesn't stop asking for another that is free now.
  const busy = Boolean(myRequest || myLoan);

  const pickupNote =
    ownerSetting === "whatsapp_after_accept"
      ? `${ownerName} will see your request. Once ${ownerName} accepts it, you'll get a WhatsApp number to arrange a time to pick it up.`
      : ownerSetting === "email_only"
        ? `${ownerName} will see your request. You will get an email address to arrange a time to pick it up.`
        : `${ownerName} will see your request. You will get a WhatsApp number to arrange a time to pick it up.`;

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
          {!isMine(featured) && featuredWaiting > 0 && (
            <p className="muted" style={{ marginTop: 6 }}>
              {peopleWaiting(featuredWaiting)}
            </p>
          )}
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

      <div style={{ marginTop: 16 }}>
        {myLoan ? (
          <div className="card stack" role="status">
            <h2 className="card-heading">You have this book</h2>
            <p>When you give it back, {ownerName} marks it as returned.</p>
            {contact && <ContactButton contact={contact} name={ownerName} />}
          </div>
        ) : myRequest ? (
          <div className="card stack" role="status">
            <h2 className="card-heading">
              {myRequest.status === "accepted"
                ? `${ownerName} accepted your request`
                : myRequest.from_waitlist
                  ? "It's your turn"
                  : `You asked ${ownerName} to borrow this book`}
            </h2>
            {myRequest.from_waitlist && myRequest.status === "open" && (
              <p>The book is back and you were first in line, so we asked {ownerName} for you.</p>
            )}
            {contact ? (
              <>
                <p>Get in touch to arrange a time to pick it up.</p>
                <ContactButton contact={contact} name={ownerName} />
              </>
            ) : (
              <p>
                {ownerName} will see your request. Once {ownerName} accepts it, you&rsquo;ll see a
                WhatsApp number here to arrange a time to pick it up.
              </p>
            )}
            <ActionButton
              action={cancelRequest.bind(null, myRequest.id)}
              pendingText="Cancelling…"
              className="text-link"
            >
              Cancel request
            </ActionButton>
          </div>
        ) : myPlace ? (
          <div className="card stack" role="status">
            <h2 className="card-heading">You&rsquo;re on the waitlist</h2>
            <p>
              You are number {myPlace.place} in line for {ownerName}&rsquo;s copy. When it&rsquo;s your
              turn, we&rsquo;ll ask {ownerName} for you.
            </p>
            {waitReasonText(myPlace.reason, ownerName) && (
              <p className="muted">{waitReasonText(myPlace.reason, ownerName)}</p>
            )}
            <ActionButton
              action={leaveWaitlist.bind(null, myPlace.entry_id)}
              pendingText="Leaving…"
              className="text-link"
            >
              Leave the waitlist
            </ActionButton>
          </div>
        ) : isMine(featured) ? null : featured.status === "paused" ? (
          <p className="muted">{ownerName} isn&rsquo;t lending right now.</p>
        ) : featured.status === "available" && featuredWaiting === 0 ? (
          <>
            <ActionButton action={requestCopy.bind(null, featured.id)} pendingText="Sending your request…">
              Request to borrow
            </ActionButton>
            <p className="muted" style={{ marginTop: 12 }}>
              {pickupNote}
            </p>
          </>
        ) : (
          <>
            <ActionButton action={requestCopy.bind(null, featured.id)} pendingText="Joining…">
              Join the waitlist
            </ActionButton>
            <p className="muted" style={{ marginTop: 12 }}>
              When the book comes back, the next person in line gets an email and can arrange to
              borrow it.
            </p>
          </>
        )}
      </div>

      {rest.length > 0 && (
        <>
          <h2 className="section-label" style={{ marginTop: 32 }}>
            Other copies
          </h2>
          <ul className="copy-list">
            {rest.map((c) => (
              <li key={c.id} className="copy-item">
                <Link href={`/members/${c.owner.id}`} className="copy-row">
                  <span className="avatar small-avatar">{initials(c.owner.full_name)}</span>
                  <span className="copy-owner">{isMine(c) ? "You" : c.owner.full_name}</span>
                  <span className={`status status-${isMine(c) ? "muted" : copyTone(c.status)}`}>
                    {isMine(c) ? "Yours" : statusLabel[c.status]}
                  </span>
                </Link>
                {!busy && !isMine(c) && c.status === "available" && !linedUp(c) && (
                  <ActionButton
                    action={requestCopy.bind(null, c.id)}
                    pendingText="Sending…"
                    className="button secondary small-button"
                  >
                    Request {firstName(c.owner.full_name)}&rsquo;s copy
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

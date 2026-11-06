import Link from "next/link";
import { requireApprovedMember } from "@/lib/auth";
import { firstName } from "@/lib/books";
import { dayAndMonth, isOverdue, reminderWords, whenAgo, type ReminderSetting } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { myPlaces, peopleWaiting, waitingCounts } from "@/lib/waitlist";
import { Cover } from "../../cover";
import { ActionButton } from "../action-button";
import { ContactButton, getContact } from "../contact";
import {
  acceptRequest,
  cancelRequest,
  declineRequest,
  leaveWaitlist,
  markLent,
  markReturned,
  stillNeedIt,
} from "../loan-actions";

type BookBits = { id: string; title: string; author: string; cover_url: string | null };
type Person = { id: string; full_name: string };
type Owner = Person & { reminder_after: ReminderSetting };

type IncomingRow = {
  id: string;
  status: "open" | "accepted";
  created_at: string;
  from_waitlist: boolean;
  requester: Person;
  copies: { on_loan: boolean; books: BookBits };
};

type MyRequestRow = {
  id: string;
  status: "open" | "accepted";
  created_at: string;
  copies: { owner: Person; books: BookBits };
};

type LoanRow = {
  id: string;
  copy_id: string;
  lent_at: string;
  reminder_from: string;
  borrower: Person;
  copies: { owner: Owner; books: BookBits };
};

type PlaceRow = {
  id: string;
  copies: { owner: Person; books: BookBits };
};

export default async function LoansPage() {
  const member = await requireApprovedMember();
  const supabase = await createClient();
  const book = "books(id, title, author, cover_url)";

  const owner = "owner:members!owner_id(id, full_name, reminder_after)";
  const [incoming, lentOut, borrowed, sent, waits, places] = await Promise.all([
    supabase
      .from("requests")
      .select(`id, status, created_at, from_waitlist, requester:members!requester_id(id, full_name), copies!inner(owner_id, on_loan, ${book})`)
      .eq("copies.owner_id", member.id)
      .in("status", ["open", "accepted"])
      .order("created_at")
      .overrideTypes<IncomingRow[], { merge: false }>(),
    supabase
      .from("loans")
      .select(`id, copy_id, lent_at, reminder_from, borrower:members!borrower_id(id, full_name), copies!inner(owner_id, ${owner}, ${book})`)
      .eq("copies.owner_id", member.id)
      .is("returned_at", null)
      .order("lent_at")
      .overrideTypes<LoanRow[], { merge: false }>(),
    supabase
      .from("loans")
      .select(`id, copy_id, lent_at, reminder_from, borrower:members!borrower_id(id, full_name), copies!inner(${owner}, ${book})`)
      .eq("borrower_id", member.id)
      .is("returned_at", null)
      .order("lent_at")
      .overrideTypes<LoanRow[], { merge: false }>(),
    supabase
      .from("requests")
      .select(`id, status, created_at, copies!inner(owner:members!owner_id(id, full_name), ${book})`)
      .eq("requester_id", member.id)
      .in("status", ["open", "accepted"])
      .order("created_at")
      .overrideTypes<MyRequestRow[], { merge: false }>(),
    supabase
      .from("waitlist")
      .select(`id, copies!inner(${owner}, ${book})`)
      .eq("member_id", member.id)
      .eq("status", "waiting")
      .order("joined_at")
      .overrideTypes<PlaceRow[], { merge: false }>(),
    myPlaces(),
  ]);
  for (const result of [incoming, lentOut, borrowed, sent, waits]) if (result.error) throw result.error;
  const placeOf = new Map(places.map((p) => [p.entry_id, p.place]));
  const waitingFor = await waitingCounts((lentOut.data ?? []).map((l) => l.copy_id));

  const requests = incoming.data ?? [];
  const contacts = new Map(
    await Promise.all(
      [...new Set([...requests.map((r) => r.requester.id), ...(borrowed.data ?? []).map((l) => l.copies.owner.id)])].map(
        async (id) => [id, await getContact(id)] as const,
      ),
    ),
  );
  const acceptFirst = member.contact_setting === "whatsapp_after_accept";
  const nothing =
    !requests.length &&
    !lentOut.data?.length &&
    !borrowed.data?.length &&
    !sent.data?.length &&
    !waits.data?.length;
  const myReminder = member.reminder_after as ReminderSetting;

  return (
    <div>
      <h1>Loans</h1>
      {nothing && (
        <p className="muted" style={{ marginTop: 16 }}>
          Nothing here yet. When someone asks for one of your books, or you borrow one, it
          shows up here. <Link href="/">Browse the library</Link>
        </p>
      )}

      {requests.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 className="section-label">Requests for your books</h2>
          <div className="stack" style={{ marginTop: 12 }}>
            {requests.map((r) => {
              const name = firstName(r.requester.full_name);
              const contact = contacts.get(r.requester.id);
              const needsAccept = acceptFirst && r.status === "open";
              return (
                <article key={r.id} className="card request-card">
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <Cover
                      title={r.copies.books.title}
                      author={r.copies.books.author}
                      coverUrl={r.copies.books.cover_url}
                      size="thumb"
                    />
                    <div>
                      <p>
                        <strong>{r.requester.full_name}</strong> wants to borrow
                      </p>
                      <p className="book-name">{r.copies.books.title}</p>
                      <p className="muted small">
                        {r.from_waitlist ? "Next on the waitlist" : `Asked ${whenAgo(r.created_at)}`}
                        {r.status === "accepted" && " · You accepted"}
                      </p>
                    </div>
                  </div>
                  {r.copies.on_loan ? (
                    <p className="warning small" style={{ marginTop: 12 }}>
                      This copy is lent out right now. You can lend it to {name} when it comes back.
                    </p>
                  ) : null}
                  <div className="button-row" style={{ marginTop: 14 }}>
                    {needsAccept ? (
                      <ActionButton action={acceptRequest.bind(null, r.id)} pendingText="Accepting…">
                        Accept
                      </ActionButton>
                    ) : r.copies.on_loan ? (
                      <span />
                    ) : (
                      <ActionButton
                        action={markLent.bind(null, r.id)}
                        pendingText="Saving…"
                      >
                        Mark as lent
                      </ActionButton>
                    )}
                    <ActionButton
                      action={declineRequest.bind(null, r.id)}
                      pendingText="Declining…"
                      className="button secondary full"
                    >
                      Decline
                    </ActionButton>
                  </div>
                  {contact && (
                    <div style={{ marginTop: 10 }}>
                      <ContactButton contact={contact} name={name} style="link" />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {(lentOut.data?.length ?? 0) > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 className="section-label">Lent out</h2>
          <ul className="loan-list">
            {lentOut.data!.map((l) => {
              const overdue = isOverdue(l.reminder_from, myReminder);
              const waitingNow = waitingFor.get(l.copy_id) ?? 0;
              return (
              <li key={l.id} className="loan-row">
                <Cover
                  title={l.copies.books.title}
                  author={l.copies.books.author}
                  coverUrl={l.copies.books.cover_url}
                  size="thumb"
                />
                <div className="loan-text">
                  <span className="book-name">{l.copies.books.title}</span>
                  <span className="muted small">
                    With {l.borrower.full_name} since {dayAndMonth(l.lent_at)}
                  </span>
                  {overdue && myReminder !== "never" && (
                    <span className="warning small">Out for more than {reminderWords[myReminder]}.</span>
                  )}
                  {waitingNow > 0 && (
                    <span className="warning small strong">{peopleWaiting(waitingNow)} for it</span>
                  )}
                </div>
                <ActionButton
                  action={markReturned.bind(null, l.id)}
                  pendingText="Saving…"
                  className="button outline small-button"
                >
                  Returned
                </ActionButton>
              </li>
              );
            })}
          </ul>
        </section>
      )}

      {(borrowed.data?.length ?? 0) > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 className="section-label">Borrowed by you</h2>
          <ul className="loan-list">
            {borrowed.data!.map((l) => {
              const contact = contacts.get(l.copies.owner.id);
              const ownerName = firstName(l.copies.owner.full_name);
              const setting = l.copies.owner.reminder_after;
              const overdue = isOverdue(l.reminder_from, setting);
              return (
                <li key={l.id} className="loan-row borrowed-row">
                  <div className="row" style={{ alignItems: "flex-start", width: "100%" }}>
                  <Cover
                    title={l.copies.books.title}
                    author={l.copies.books.author}
                    coverUrl={l.copies.books.cover_url}
                    size="thumb"
                  />
                  <div className="loan-text">
                    <span className="book-name">{l.copies.books.title}</span>
                    <span className="muted small">
                      From {l.copies.owner.full_name} since {dayAndMonth(l.lent_at)}
                    </span>
                    {overdue && setting !== "never" && (
                      <span className="warning small">You have had this for over {reminderWords[setting]}.</span>
                    )}
                    {contact && <ContactButton contact={contact} name={ownerName} style="link" />}
                  </div>
                  </div>
                  {overdue && setting !== "never" && (
                    <ActionButton
                      action={stillNeedIt.bind(null, l.id)}
                      pendingText="Saving…"
                      className="button outline small-button"
                    >
                      Tell {ownerName} I still need it
                    </ActionButton>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="muted small" style={{ marginTop: 12 }}>
            When you give a book back, the owner marks it as returned.
          </p>
        </section>
      )}

      {(sent.data?.length ?? 0) > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 className="section-label">Your requests</h2>
          <ul className="loan-list">
            {sent.data!.map((r) => (
              <li key={r.id} className="loan-row">
                <Cover
                  title={r.copies.books.title}
                  author={r.copies.books.author}
                  coverUrl={r.copies.books.cover_url}
                  size="thumb"
                />
                <div className="loan-text">
                  <Link href={`/books/${r.copies.books.id}`} className="book-name book-link">
                    {r.copies.books.title}
                  </Link>
                  <span className="muted small">
                    {r.status === "accepted"
                      ? `${firstName(r.copies.owner.full_name)} accepted your request`
                      : `Asked ${r.copies.owner.full_name} ${whenAgo(r.created_at)}`}
                  </span>
                </div>
                <ActionButton
                  action={cancelRequest.bind(null, r.id)}
                  pendingText="Cancelling…"
                  className="button secondary small-button"
                >
                  Cancel
                </ActionButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(waits.data?.length ?? 0) > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 className="section-label">Waitlists you are on</h2>
          <ul className="loan-list">
            {waits.data!.map((w) => (
              <li key={w.id} className="loan-row">
                <Cover
                  title={w.copies.books.title}
                  author={w.copies.books.author}
                  coverUrl={w.copies.books.cover_url}
                  size="thumb"
                />
                <div className="loan-text">
                  <Link href={`/books/${w.copies.books.id}`} className="book-name book-link">
                    {w.copies.books.title}
                  </Link>
                  <span className="muted small">
                    From {w.copies.owner.full_name}. You are number {placeOf.get(w.id) ?? 1} in line.
                  </span>
                </div>
                <ActionButton
                  action={leaveWaitlist.bind(null, w.id)}
                  pendingText="Leaving…"
                  className="button secondary small-button"
                >
                  Leave
                </ActionButton>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

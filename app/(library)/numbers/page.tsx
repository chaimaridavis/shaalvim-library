import { requireAdmin } from "@/lib/auth";
import { isOverdue, type ReminderSetting } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/server";

type MemberRow = { id: string; full_name: string; reminder_after: ReminderSetting };
type CopyRow = {
  id: string;
  owner_id: string;
  book_id: string;
  removed_at: string | null;
  books: { title: string; author: string | null } | null;
};
type RequestRow = { copy_id: string; status: string; accepted_at: string | null; from_waitlist: boolean };
type LoanRow = { copy_id: string; borrower_id: string; returned_at: string | null; reminder_from: string };
type WaitRow = { copy_id: string; status: string };

const many = (n: number, one: string, more = `${one}s`) => `${n} ${n === 1 ? one : more}`;

// The library's numbers, for the administrator only. Members can only see
// their own requests and loans, so this reads everything with the admin key,
// after checking that the visitor is the administrator.
export default async function NumbersPage() {
  await requireAdmin();
  const db = createAdminClient();
  const [members, copies, requests, loans, waits] = await Promise.all([
    db.from("members").select("id, full_name, reminder_after").overrideTypes<MemberRow[], { merge: false }>(),
    db
      .from("copies")
      .select("id, owner_id, book_id, removed_at, books(title, author)")
      .overrideTypes<CopyRow[], { merge: false }>(),
    db
      .from("requests")
      .select("copy_id, status, accepted_at, from_waitlist")
      .overrideTypes<RequestRow[], { merge: false }>(),
    db
      .from("loans")
      .select("copy_id, borrower_id, returned_at, reminder_from")
      .overrideTypes<LoanRow[], { merge: false }>(),
    db.from("waitlist").select("copy_id, status").overrideTypes<WaitRow[], { merge: false }>(),
  ]);
  const people = members.data ?? [];
  const allCopies = copies.data ?? [];
  const allRequests = requests.data ?? [];
  const allLoans = loans.data ?? [];
  const allWaits = waits.data ?? [];

  const copyById = new Map(allCopies.map((c) => [c.id, c]));
  const memberById = new Map(people.map((m) => [m.id, m]));
  const onShelf = allCopies.filter((c) => !c.removed_at);
  const titles = new Set(onShelf.map((c) => c.book_id)).size;

  // Requests made directly; ones made for someone at the front of a waitlist
  // are counted under the waitlist instead.
  const asked = allRequests.filter((r) => !r.from_waitlist);
  const accepted = allRequests.filter((r) => r.accepted_at || r.status === "lent").length;
  const declined = allRequests.filter((r) => r.status === "declined").length;
  const cancelled = allRequests.filter((r) => r.status === "cancelled").length;
  const awaiting = allRequests.filter((r) => r.status === "open").length;

  const out = allLoans.filter((l) => !l.returned_at);
  const overdue = out.filter((l) => {
    const owner = memberById.get(copyById.get(l.copy_id)?.owner_id ?? "");
    return owner ? isOverdue(l.reminder_from, owner.reminder_after) : false;
  }).length;
  const waiting = allWaits.filter((w) => w.status === "waiting").length;

  // Per member.
  const tally = new Map(people.map((m) => [m.id, { shelf: 0, lent: 0, borrowed: 0 }]));
  for (const c of onShelf) {
    const t = tally.get(c.owner_id);
    if (t) t.shelf++;
  }
  for (const l of allLoans) {
    const owner = copyById.get(l.copy_id)?.owner_id;
    if (owner && tally.has(owner)) tally.get(owner)!.lent++;
    if (tally.has(l.borrower_id)) tally.get(l.borrower_id)!.borrowed++;
  }
  const perMember = people
    .map((m) => ({ ...m, ...tally.get(m.id)! }))
    .sort((a, b) => b.shelf - a.shelf || a.full_name.localeCompare(b.full_name));

  // Most asked-for books: direct requests plus places taken on waitlists.
  const interest = new Map<string, { title: string; author: string | null; times: number }>();
  const count = (copyId: string) => {
    const c = copyById.get(copyId);
    if (!c?.books) return;
    const row = interest.get(c.book_id) ?? { title: c.books.title, author: c.books.author, times: 0 };
    row.times++;
    interest.set(c.book_id, row);
  };
  for (const r of asked) count(r.copy_id);
  for (const w of allWaits) count(w.copy_id);
  const popular = [...interest.values()]
    .sort((a, b) => b.times - a.times || a.title.localeCompare(b.title))
    .slice(0, 10);

  return (
    <div className="stack numbers">
      <h1>Numbers</h1>
      <p className="muted">Only you can see this page. Everything counts from the day the library opened.</p>

      <h2 className="section-label">Overall</h2>
      <div className="stat-grid">
        <Stat n={people.length} label={people.length === 1 ? "member" : "members"} />
        <Stat n={onShelf.length} label="books on shelves" note={many(titles, "different title")} />
        <Stat n={asked.length} label="requests made" />
        <Stat n={accepted} label="accepted" />
        <Stat n={declined} label="declined" note={cancelled ? `${cancelled} cancelled by the asker` : undefined} />
        <Stat n={allLoans.length} label="times a book was lent" />
      </div>

      <h2 className="section-label">Right now</h2>
      <div className="stat-grid four">
        <Stat n={out.length} label="books out on loan" />
        <Stat n={overdue} label="overdue" />
        <Stat n={awaiting} label="requests waiting for an answer" />
        <Stat n={waiting} label="places on waitlists" />
      </div>

      <h2 className="section-label">Each member</h2>
      <div className="card table-card">
        <table className="numbers-table">
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">On shelf</th>
              <th scope="col">Lent out</th>
              <th scope="col">Borrowed</th>
            </tr>
          </thead>
          <tbody>
            {perMember.map((m) => (
              <tr key={m.id}>
                <th scope="row">{m.full_name}</th>
                <td>{m.shelf}</td>
                <td>{m.lent}</td>
                <td>{m.borrowed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Lent out and Borrowed count every time, including books since returned.</p>

      <h2 className="section-label">Most asked-for books</h2>
      {popular.length ? (
        <ol className="card popular-list">
          {popular.map((b) => (
            <li key={`${b.title}-${b.author}`}>
              <span>
                <strong>{b.title}</strong>
                {b.author && <span className="muted"> · {b.author}</span>}
              </span>
              <span className="muted">{many(b.times, "time")}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">Nobody has asked for a book yet.</p>
      )}
    </div>
  );
}

function Stat({ n, label, note }: { n: number; label: string; note?: string }) {
  return (
    <div className="card stat">
      <span className="stat-number">{n}</span>
      <span className="stat-label">{label}</span>
      {note && <span className="muted small">{note}</span>}
    </div>
  );
}

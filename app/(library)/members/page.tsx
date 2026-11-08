import { requireAdmin } from "@/lib/auth";
import { dayAndMonth } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "../action-button";
import { removeMember } from "./actions";

type Row = {
  id: string;
  full_name: string;
  created_at: string;
  is_admin: boolean;
  member_contacts: { email: string; whatsapp: string } | null;
};

// Everyone in the library, for the administrator only.
export default async function MembersPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const [{ data: members }, { data: copies }] = await Promise.all([
    supabase
      .from("members")
      .select("id, full_name, created_at, is_admin, member_contacts(email, whatsapp)")
      .order("created_at", { ascending: false })
      .overrideTypes<Row[], { merge: false }>(),
    supabase.from("copies").select("owner_id").is("removed_at", null),
  ]);
  const shelf = new Map<string, number>();
  for (const c of copies ?? []) shelf.set(c.owner_id, (shelf.get(c.owner_id) ?? 0) + 1);
  const list = members ?? [];

  return (
    <div className="stack narrow">
      <h1>Members</h1>
      <p className="muted">
        Only you can see this page. {list.length} {list.length === 1 ? "member" : "members"}, newest
        first.
      </p>
      {list.map((m) => {
        const books = shelf.get(m.id) ?? 0;
        return (
          <section key={m.id} className="card person">
            <h2>{m.full_name}</h2>
            <p style={{ marginTop: 6 }}>{m.member_contacts?.email}</p>
            <p>WhatsApp {m.member_contacts?.whatsapp}</p>
            <p className="muted small">
              Joined {dayAndMonth(m.created_at)} · {books} {books === 1 ? "book" : "books"}
            </p>
            {m.id !== admin.id && (
              <div style={{ marginTop: 14 }}>
                <ActionButton
                  action={removeMember.bind(null, m.id)}
                  pendingText="Removing…"
                  className="button secondary small-button"
                  confirm={`Remove ${m.full_name} and their books?`}
                >
                  Remove from the library
                </ActionButton>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "../../submit-button";
import { approve, decline } from "./actions";

type Waiting = {
  id: string;
  full_name: string;
  member_contacts: { email: string; whatsapp: string } | null;
};

export default async function ApprovalsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, full_name, member_contacts(email, whatsapp)")
    .eq("status", "pending")
    .order("created_at")
    .overrideTypes<Waiting[], { merge: false }>();
  const waiting = data ?? [];

  return (
    <div className="stack">
      <h1>People waiting to join</h1>
      <p className="muted">Only you can see this page.</p>

      {waiting.length === 0 && <p>Nobody is waiting to join right now.</p>}

      {waiting.map((person) => (
        <section key={person.id} className="card person">
          <h2>{person.full_name}</h2>
          <p style={{ marginTop: 6 }}>{person.member_contacts?.email}</p>
          <p>WhatsApp {person.member_contacts?.whatsapp}</p>
          <div className="button-row" style={{ marginTop: 16 }}>
            <form action={approve}>
              <input type="hidden" name="id" value={person.id} />
              <SubmitButton pendingText="Approving…">Approve</SubmitButton>
            </form>
            <form action={decline}>
              <input type="hidden" name="id" value={person.id} />
              <SubmitButton pendingText="Declining…" className="button secondary full">
                Decline
              </SubmitButton>
            </form>
          </div>
        </section>
      ))}
    </div>
  );
}

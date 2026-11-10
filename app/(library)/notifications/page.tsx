import { requireApprovedMember } from "@/lib/auth";
import { whenAgo } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { NoteList } from "./note-list";

type Row = { id: string; message: string; link: string; created_at: string; read_at: string | null };

export default async function NotificationsPage() {
  const member = await requireApprovedMember();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, message, link, created_at, read_at")
    .eq("member_id", member.id)
    .order("created_at", { ascending: false })
    .limit(50)
    .overrideTypes<Row[], { merge: false }>();
  const notes = (data ?? []).map((n) => ({
    id: n.id,
    message: n.message,
    link: n.link,
    when: whenAgo(n.created_at).replace(/^on /, ""),
    isNew: !n.read_at,
  }));

  return (
    <div className="narrow">
      <h1>Notifications</h1>
      {notes.length === 0 ? (
        <p className="muted" style={{ marginTop: 16 }}>
          Nothing yet. When someone asks for one of your books, or something happens to a book
          you asked for, it shows up here.
        </p>
      ) : (
        <NoteList notes={notes} />
      )}
    </div>
  );
}

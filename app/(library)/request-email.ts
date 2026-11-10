import "server-only";
import { firstName } from "@/lib/books";
import { sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/server";

// Emails the owner when someone they've never lent to (or borrowed from)
// asks for one of their books. Once two people have had a request accepted
// between them, they have each other's WhatsApp and the bell is enough.
export async function emailFirstRequest(askerId: string, copyId: string, origin: string) {
  const db = createAdminClient();

  const { data: request } = await db
    .from("requests")
    .select("id, created_at, copies(owner_id, books(title))")
    .eq("copy_id", copyId)
    .eq("requester_id", askerId)
    .in("status", ["open", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      created_at: string;
      copies: { owner_id: string; books: { title: string } | null } | null;
    }>();
  const ownerId = request?.copies?.owner_id;
  const title = request?.copies?.books?.title;
  if (!request || !ownerId || !title) return;
  // "requested" is also the answer when asking again for a copy already asked
  // for; only a request made just now gets an email.
  if (Date.now() - new Date(request.created_at).getTime() > 2 * 60 * 1000) return;

  if (await connected(askerId, ownerId, request.id)) return;

  const [{ data: asker }, { data: owner }] = await Promise.all([
    db.from("members").select("full_name").eq("id", askerId).single(),
    db
      .from("members")
      .select("full_name, member_contacts(email)")
      .eq("id", ownerId)
      .single<{ full_name: string; member_contacts: { email: string } | null }>(),
  ]);
  const to = owner?.member_contacts?.email;
  if (!asker || !owner || !to) return;

  await sendEmail({
    to,
    subject: `${asker.full_name} would like to borrow ${title}`,
    lines: [
      `Hi ${firstName(owner.full_name)},`,
      `${asker.full_name} has asked to borrow your copy of ${title} on the Shaalvim Library.`,
      `Open Loans to accept or decline. If you accept, you'll both see each other's WhatsApp number to arrange a time.`,
    ],
    button: { text: "Open Loans", url: `${origin}/loans` },
  });
}

// Whether a request between these two, either way round, has ever been
// accepted.
async function connected(a: string, b: string, except: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("requests")
    .select("id, requester_id, copies!inner(owner_id)")
    .in("requester_id", [a, b])
    .in("copies.owner_id", [a, b])
    .or("accepted_at.not.is.null,status.eq.lent")
    .neq("id", except)
    .overrideTypes<{ id: string; requester_id: string; copies: { owner_id: string } }[], { merge: false }>();
  return (data ?? []).some((r) => r.requester_id !== r.copies.owner_id);
}

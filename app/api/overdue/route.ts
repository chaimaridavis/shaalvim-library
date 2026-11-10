import { firstName } from "@/lib/books";
import { dayAndMonth, isOverdue, type ReminderSetting } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/server";

type LoanRow = {
  id: string;
  lent_at: string;
  reminder_from: string;
  borrower: { full_name: string; member_contacts: { email: string } | null } | null;
  copies: {
    owner: { full_name: string; reminder_after: ReminderSetting } | null;
    books: { title: string } | null;
  } | null;
  borrower_id: string;
};

// Run once a day by Vercel (see vercel.json). Each borrowed book that has
// passed its owner's reminder time gets one reminder: an email and a note
// under the bell. "I still need it" starts the clock again. Running it twice
// does nothing extra, because each reminder is marked as sent.
export async function GET(request: Request) {
  const db = createAdminClient();
  const { data: loans, error } = await db
    .from("loans")
    .select(
      "id, lent_at, reminder_from, borrower_id, borrower:members!loans_borrower_id_fkey(full_name, member_contacts(email)), copies(owner:members(full_name, reminder_after), books(title))",
    )
    .is("returned_at", null)
    .is("reminder_sent_at", null)
    .overrideTypes<LoanRow[], { merge: false }>();
  if (error) {
    console.error("Overdue check failed", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const origin = production ? `https://${production}` : new URL(request.url).origin;
  let sent = 0;

  for (const loan of loans ?? []) {
    const owner = loan.copies?.owner;
    const title = loan.copies?.books?.title;
    const borrower = loan.borrower;
    if (!owner || !title || !borrower) continue;
    if (!isOverdue(loan.reminder_from, owner.reminder_after)) continue;

    // Mark it first, so a slow email can never lead to a second reminder.
    const { data: claimed } = await db
      .from("loans")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", loan.id)
      .is("reminder_sent_at", null)
      .select("id");
    if (!claimed?.length) continue;

    const ownerName = firstName(owner.full_name);
    await db.from("notifications").insert({
      member_id: loan.borrower_id,
      message: `It's time to give ${title} back to ${ownerName}, or tell ${ownerName} you still need it.`,
      link: "/loans",
    });
    const to = borrower.member_contacts?.email;
    if (to) {
      await sendEmail({
        to,
        subject: `A reminder about ${title}`,
        lines: [
          `Hi ${firstName(borrower.full_name)},`,
          `You borrowed ${title} from ${ownerName} on ${dayAndMonth(loan.lent_at)}.`,
          `If you've finished it, please arrange a time to give it back. If you're still reading, open Loans and tap "Tell ${ownerName} I still need it".`,
        ],
        button: { text: "Open Loans", url: `${origin}/loans` },
      });
    }
    sent++;
  }

  return Response.json({ reminders: sent });
}

"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

// What the database's rule-checks mean, in words for members.
const reasons: Record<string, string> = {
  lent_out: "Someone else has this copy right now.",
  paused: "The owner isn't lending right now.",
  own_book: "This is your own copy.",
  not_available: "This copy is no longer on the shelf.",
  not_found: "That request has already been handled.",
  not_member: "Please sign in again.",
  already_borrowing: "You already have this copy.",
  need_books: "Add at least 5 of your own books to your shelf first.",
  not_admin: "Only the administrator can do that.",
  not_yourself: "You can't remove yourself.",
};

async function run(fn: string, args: Record<string, string>): Promise<ActionResult> {
  await requireApprovedMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  revalidatePath("/", "layout");
  if (!error) return {};
  if (reasons[error.message]) return { error: reasons[error.message] };
  console.error(`${fn} failed`, error);
  return { error: "Something went wrong. Please try again in a minute." };
}

// Asks to borrow, or joins the waitlist when the copy can't be lent now.
export async function requestCopy(copyId: string) {
  return run("request_copy", { p_copy: copyId });
}

export async function leaveWaitlist(entryId: string) {
  return run("leave_waitlist", { p_entry: entryId });
}

export async function stillNeedIt(loanId: string) {
  return run("still_need_it", { p_loan: loanId });
}

export async function cancelRequest(requestId: string) {
  return run("cancel_request", { p_request: requestId });
}

export async function acceptRequest(requestId: string) {
  return run("accept_request", { p_request: requestId });
}

export async function declineRequest(requestId: string) {
  return run("decline_request", { p_request: requestId });
}

export async function markLent(requestId: string) {
  return run("mark_lent", { p_request: requestId });
}

export async function markReturned(loanId: string) {
  return run("mark_returned", { p_loan: loanId });
}

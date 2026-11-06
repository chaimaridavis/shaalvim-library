import "server-only";
import { createClient } from "@/lib/supabase/server";

export type WaitReason = "lent_out" | "line" | "limit_total" | "limit_borrower";
export type MyPlace = { entry_id: string; copy_id: string; place: number; reason: WaitReason };

// How many people are waiting for each copy (numbers only, never names).
export async function waitingCounts(copyIds: string[]): Promise<Map<string, number>> {
  if (!copyIds.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.rpc("waiting_counts", { p_copies: copyIds });
  return new Map(((data ?? []) as { copy_id: string; waiting: number }[]).map((r) => [r.copy_id, r.waiting]));
}

// The signed-in member's places in line.
export async function myPlaces(): Promise<MyPlace[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_waitlists");
  return (data ?? []) as MyPlace[];
}

export function peopleWaiting(n: number): string {
  return `${n} ${n === 1 ? "person" : "people"} waiting`;
}

// Why a member is on a waitlist instead of having asked, in words.
export function waitReasonText(reason: WaitReason, ownerName: string): string | null {
  switch (reason) {
    case "limit_total":
      return `${ownerName} has lent out as many books as they lend at one time, so you're on the waitlist.`;
    case "limit_borrower":
      return `You have as many of ${ownerName}'s books as they lend to one person at a time, so you're on the waitlist.`;
    case "line":
      return "Others were already waiting for this copy, so you're in line after them.";
    default:
      return null;
  }
}

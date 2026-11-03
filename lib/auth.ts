import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ContactSetting = "whatsapp_any" | "whatsapp_after_accept" | "email_only";
export type ReminderAfter = "two_weeks" | "one_month" | "two_months" | "never";

export type Member = {
  id: string;
  full_name: string;
  status: "pending" | "approved";
  is_admin: boolean;
  contact_setting: ContactSetting;
  max_lent_at_once: number | null;
  max_per_borrower: number | null;
  reminder_after: ReminderAfter;
  lending_paused: boolean;
};

// The signed-in person's member record, or null if nobody is signed in.
export const getCurrentMember = cache(async (): Promise<Member | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("members")
    .select(
      "id, full_name, status, is_admin, contact_setting, max_lent_at_once, max_per_borrower, reminder_after, lending_paused",
    )
    .eq("id", userId)
    .maybeSingle();
  return data;
});

// For pages inside the library: sends everyone else to the right place.
export async function requireApprovedMember(): Promise<Member> {
  const member = await getCurrentMember();
  if (!member) redirect("/join");
  if (member.status !== "approved") redirect("/waiting");
  return member;
}

export async function requireAdmin(): Promise<Member> {
  const member = await requireApprovedMember();
  if (!member.is_admin) redirect("/");
  return member;
}

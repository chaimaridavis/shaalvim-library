"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../loan-actions";

// Removing a member removes their books and ends their requests and waitlist
// places. Books they had borrowed go back on their owners' shelves.
export async function removeMember(memberId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error: prepError } = await supabase.rpc("prepare_member_removal", { p_member: memberId });
  if (prepError) {
    if (prepError.message === "not_yourself") return { error: "You can't remove yourself." };
    console.error("prepare_member_removal failed", prepError);
    return { error: "Something went wrong. Please try again in a minute." };
  }
  const { error } = await createAdminClient().auth.admin.deleteUser(memberId);
  if (error) {
    console.error("deleteUser failed", error);
    return { error: "Something went wrong. Please try again in a minute." };
  }
  revalidatePath("/", "layout");
  return {};
}

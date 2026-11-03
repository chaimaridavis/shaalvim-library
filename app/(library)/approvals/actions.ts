"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export async function approve(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));

  const { error } = await createAdminClient()
    .from("members")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw error;

  revalidatePath("/approvals");
}

// Declining removes the request entirely, so the person may ask again later.
export async function decline(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const admin = createAdminClient();

  const { data: person } = await admin
    .from("members")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (person?.status !== "pending") return;

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw error;

  revalidatePath("/approvals");
}

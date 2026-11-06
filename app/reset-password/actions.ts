"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cleanPassword, passwordRule } from "@/lib/validate";

export type ResetState = { error?: string };

export async function setNewPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const password = cleanPassword(formData.get("password"));
  if (!password) return { error: passwordRule };
  if (password !== formData.get("confirm")) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") {
      return { error: "That's your current password. Please choose a different one." };
    }
    if (error.code === "session_not_found" || error.status === 401) {
      redirect("/forgot-password");
    }
    console.error("updateUser password failed", error);
    return { error: "Something went wrong. Please try again in a minute." };
  }

  redirect("/");
}

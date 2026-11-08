"use server";

import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { cleanEmail, cleanName, cleanPassword, cleanWhatsApp, passwordRule } from "@/lib/validate";

export type JoinState = {
  error?: string;
  values?: { full_name: string; email: string; whatsapp: string };
};

export async function askToJoin(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const values = {
    full_name: String(formData.get("full_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    whatsapp: String(formData.get("whatsapp") ?? ""),
  };
  const fullName = cleanName(formData.get("full_name"));
  const email = cleanEmail(formData.get("email"));
  const whatsapp = cleanWhatsApp(formData.get("whatsapp"));
  const password = cleanPassword(formData.get("password"));

  if (!fullName) return { error: "Please enter your first and last name.", values };
  if (!email) return { error: "Please check your email address.", values };
  if (!whatsapp) return { error: "Please check your WhatsApp number.", values };
  if (!password) return { error: `Please choose a password. ${passwordRule}`, values };

  const isAdmin = email === process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const admin = createAdminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) {
    if (error.code === "email_exists") {
      return {
        error: "That email already has an account. Use Sign in below instead.",
        values,
      };
    }
    console.error("createUser failed", error);
    return { error: "Something went wrong. Please try again in a minute.", values };
  }

  const userId = created.user.id;
  const { error: memberError } = await admin.from("members").insert({
    id: userId,
    full_name: fullName,
    status: "approved",
    is_admin: isAdmin,
    approved_at: new Date().toISOString(),
  });
  const { error: contactError } = memberError
    ? { error: null }
    : await admin.from("member_contacts").insert({ member_id: userId, email, whatsapp });

  if (memberError || contactError) {
    console.error("saving member failed", memberError ?? contactError);
    await admin.auth.admin.deleteUser(userId);
    return { error: "Something went wrong. Please try again in a minute.", values };
  }

  // Anyone may join; sign them straight in.
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/my-books?welcome=1");
}

"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedMember, type ContactSetting, type ReminderAfter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import { cleanEmail, cleanName, cleanWhatsApp } from "@/lib/validate";

export type ProfileState = { error?: string; saved?: string };

const contactSettings: ContactSetting[] = ["whatsapp_any", "whatsapp_after_accept", "email_only"];
const reminderOptions: ReminderAfter[] = ["two_weeks", "one_month", "two_months", "never"];

function limit(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 99 ? n : null;
}

export async function saveProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const member = await requireApprovedMember();
  const supabase = await createClient();

  const fullName = cleanName(formData.get("full_name"));
  const email = cleanEmail(formData.get("email"));
  const whatsapp = cleanWhatsApp(formData.get("whatsapp"));
  const contactSetting = String(formData.get("contact_setting")) as ContactSetting;
  const reminderAfter = String(formData.get("reminder_after")) as ReminderAfter;

  if (!fullName) return { error: "Please enter your first and last name." };
  if (!email) return { error: "Please check your email address." };
  if (!whatsapp) return { error: "Please check your WhatsApp number." };
  if (!contactSettings.includes(contactSetting) || !reminderOptions.includes(reminderAfter)) {
    return { error: "Please choose one of the options." };
  }

  const { error: memberError } = await supabase
    .from("members")
    .update({
      full_name: fullName,
      contact_setting: contactSetting,
      max_lent_at_once: limit(formData.get("max_lent_at_once")),
      max_per_borrower: limit(formData.get("max_per_borrower")),
      reminder_after: reminderAfter,
      lending_paused: formData.get("lending_paused") === "on",
    })
    .eq("id", member.id);
  const { error: contactError } = await supabase
    .from("member_contacts")
    .update({ whatsapp })
    .eq("member_id", member.id);

  if (memberError || contactError) {
    console.error("saving profile failed", memberError ?? contactError);
    return { error: "Something went wrong. Please try again in a minute." };
  }
  revalidatePath("/", "layout");

  const { data: current } = await supabase
    .from("member_contacts")
    .select("email")
    .eq("member_id", member.id)
    .single();
  if (current && current.email !== email) {
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=email` },
    );
    if (error) {
      if (error.code === "email_exists") {
        return { error: "Your other changes are saved, but another member already uses that email." };
      }
      console.error("updateUser email failed", error);
      return { error: "Your other changes are saved, but we couldn't change your email. Please try again later." };
    }
    return {
      saved: `Saved. To finish changing your email, open the confirmation link we sent to ${email}. We may also send one to your current address. Until then, keep signing in with your current email.`,
    };
  }

  return { saved: "Saved." };
}

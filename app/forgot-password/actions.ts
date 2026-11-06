"use server";

import { createLinkClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import { cleanEmail } from "@/lib/validate";

export type ForgotState = { error?: string; sentTo?: string; email?: string };

export async function sendResetLink(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const typed = String(formData.get("email") ?? "");
  const email = cleanEmail(formData.get("email"));
  if (!email) return { error: "Please check your email address.", email: typed };

  const { error } = await createLinkClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=reset`,
  });

  if (error) {
    if (error.status === 429) {
      return {
        error: "Too many emails were sent just now. Please wait a few minutes and try again.",
        email: typed,
      };
    }
    console.error("resetPasswordForEmail failed", error);
    return { error: "Something went wrong. Please try again in a minute.", email: typed };
  }

  return { sentTo: email };
}

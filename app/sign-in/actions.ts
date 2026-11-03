"use server";

import { createLinkClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import { cleanEmail } from "@/lib/validate";

export type SignInState = { error?: string; sentTo?: string; email?: string };

// Emails a sign-in link. Other ways to sign in (such as Google) can sit
// beside this one later without changing it.
export async function sendSignInLink(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const typed = String(formData.get("email") ?? "");
  const email = cleanEmail(formData.get("email"));
  if (!email) return { error: "Please check your email address.", email: typed };

  const { error } = await createLinkClient().auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
    },
  });

  if (error) {
    if (error.code === "otp_disabled" || error.code === "user_not_found") {
      return {
        error: "We don't have that email yet. Ask to join first, or check for a typo.",
        email: typed,
      };
    }
    if (error.status === 429) {
      return {
        error: "Too many sign-in emails were sent just now. Please wait a few minutes and try again.",
        email: typed,
      };
    }
    console.error("signInWithOtp failed", error);
    return { error: "Something went wrong. Please try again in a minute.", email: typed };
  }

  return { sentTo: email };
}

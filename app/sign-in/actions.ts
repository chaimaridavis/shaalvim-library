"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cleanEmail } from "@/lib/validate";

export type SignInState = { error?: string; email?: string };

// Email and password. Other ways to sign in (such as Google) can sit beside
// this one later without changing it.
export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const typed = String(formData.get("email") ?? "");
  const email = cleanEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email) return { error: "Please check your email address.", email: typed };
  if (!password) return { error: "Please enter your password.", email: typed };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "invalid_credentials") {
      return {
        error: "That email and password don't match. Check for a typo, or use \"Forgot your password?\"",
        email: typed,
      };
    }
    if (error.status === 429) {
      return { error: "Too many tries just now. Please wait a few minutes and try again.", email: typed };
    }
    console.error("signInWithPassword failed", error);
    return { error: "Something went wrong. Please try again in a minute.", email: typed };
  }

  redirect("/");
}

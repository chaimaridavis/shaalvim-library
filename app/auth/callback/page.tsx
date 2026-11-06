"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";

// Where links in Supabase's emails lead. A forgot-password link arrives with
// the session in the part of the address after "#", which only the browser
// can read; a change-of-email link arrives with a one-time "code" instead.
export default function AuthCallbackPage() {
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const destinations: Record<string, string> = {
      email: "/profile?email=confirmed",
      reset: "/reset-password",
    };
    const next = destinations[query.get("next") ?? ""] ?? "/";
    const supabase = createClient();

    async function finish() {
      const failed = hash.get("error_description") ?? query.get("error_description");
      if (failed) {
        setProblem("That link has expired or was already used.");
        return;
      }

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const code = query.get("code");
      const { error } = accessToken && refreshToken
        ? await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        : code
          ? await supabase.auth.exchangeCodeForSession(code)
          : { error: null };

      if (error) {
        setProblem("That link has expired or was already used.");
        return;
      }
      // A full page load, so the server sees the new sign-in.
      window.location.replace(next);
    }
    finish();
  }, []);

  return (
    <main className="page">
      <div className="stack" style={{ marginTop: 24 }}>
        <p className="muted" style={{ fontFamily: "var(--serif)", fontSize: 19 }}>
          Shaalvim Library
        </p>
        {problem ? (
          <>
            <h1>That didn&rsquo;t work</h1>
            <p>{problem}</p>
            <p>
              <Link href="/sign-in">Get a new sign-in link</Link>
            </p>
          </>
        ) : (
          <h1>Signing you in…</h1>
        )}
      </div>
    </main>
  );
}

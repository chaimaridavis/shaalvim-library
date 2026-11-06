import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Acts as the signed-in member, so the database's own rules apply.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Pages can't set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

// Sends forgot-password links that work in whichever browser opens them,
// which matters on phones where the email app may open a different browser.
// It holds no session itself; /auth/callback stores the session.
export function createLinkClient() {
  return createPlainClient(url, publishableKey, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false },
  });
}

// Bypasses the database's rules. Use only after checking who is asking.
export function createAdminClient() {
  return createPlainClient(url, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

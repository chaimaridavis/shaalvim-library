import "server-only";
import { headers } from "next/headers";

// The address the visitor is using, such as http://localhost:3000 or the
// Vercel address, so links in emails lead back to the same place.
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

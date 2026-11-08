import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { JoinForm } from "./join-form";

export default async function JoinPage() {
  const member = await getCurrentMember();
  if (member) redirect("/");

  return (
    <main className="page">
      <div className="stack">
        <p className="muted" style={{ fontFamily: "var(--serif)", fontSize: 19, marginTop: 24 }}>
          Shaalvim Library
        </p>
        <h1 style={{ fontSize: 32 }}>Share your English books with your neighbors</h1>
        <p className="muted" style={{ fontSize: 18 }}>
          Put your books on the shared shelf and borrow theirs.
        </p>
      </div>
      <div style={{ marginTop: 32 }}>
        <JoinForm />
      </div>
      <p style={{ textAlign: "center", marginTop: 20 }}>
        Already a member? <Link href="/sign-in">Sign in</Link>
      </p>
    </main>
  );
}

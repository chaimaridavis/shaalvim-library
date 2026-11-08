import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage() {
  const member = await getCurrentMember();
  if (member) redirect("/");

  return (
    <main className="page">
      <div className="stack" style={{ marginTop: 24 }}>
        <p className="muted" style={{ fontFamily: "var(--serif)", fontSize: 19 }}>
          Shaalvim Library
        </p>
        <h1>Sign in</h1>
      </div>
      <div style={{ marginTop: 28 }}>
        <SignInForm />
      </div>
      <p style={{ textAlign: "center", marginTop: 20 }}>
        New here? <Link href="/join">Join the library</Link>
      </p>
    </main>
  );
}

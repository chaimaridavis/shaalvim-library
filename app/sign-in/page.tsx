import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const member = await getCurrentMember();
  if (member) redirect(member.status === "approved" ? "/" : "/waiting");

  const { welcome, error } = await searchParams;

  return (
    <main className="page">
      <div className="stack" style={{ marginTop: 24 }}>
        <p className="muted" style={{ fontFamily: "var(--serif)", fontSize: 19 }}>
          Shaalvim Library
        </p>
        <h1>Sign in</h1>
        {welcome === "admin" && (
          <p className="notice">
            Your administrator account is ready. Sign in below to start approving members.
          </p>
        )}
        {error === "link" && (
          <p className="notice">
            That sign-in link has expired or was already used. Enter your email to get a new one.
          </p>
        )}
      </div>
      <div style={{ marginTop: 28 }}>
        <SignInForm />
      </div>
      <p style={{ textAlign: "center", marginTop: 20 }}>
        New here? <Link href="/join">Ask to join</Link>
      </p>
    </main>
  );
}

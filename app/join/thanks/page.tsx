import Link from "next/link";

export default function ThanksPage() {
  return (
    <main className="page">
      <div className="stack" style={{ marginTop: 24 }}>
        <p className="muted" style={{ fontFamily: "var(--serif)", fontSize: 19 }}>
          Shaalvim Library
        </p>
        <h1>Thank you for asking to join</h1>
        <p>
          An organizer will review your request and email you once you&rsquo;re
          approved. Then you can sign in with your email and password and start
          borrowing.
        </p>
        <p>
          <Link href="/sign-in">Sign in</Link>
        </p>
      </div>
    </main>
  );
}

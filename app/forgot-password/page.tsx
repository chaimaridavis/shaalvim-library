import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export default function ForgotPasswordPage() {
  return (
    <main className="page">
      <div className="stack" style={{ marginTop: 24 }}>
        <p className="muted" style={{ fontFamily: "var(--serif)", fontSize: 19 }}>
          Shaalvim Library
        </p>
        <h1>Forgot your password?</h1>
      </div>
      <div style={{ marginTop: 28 }}>
        <ForgotForm />
      </div>
      <p style={{ textAlign: "center", marginTop: 20 }}>
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </main>
  );
}

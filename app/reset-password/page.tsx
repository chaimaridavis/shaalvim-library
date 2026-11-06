import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { ResetForm } from "./reset-form";

// Reached from the link in a "forgot your password" email, which signs the
// member in first.
export default async function ResetPasswordPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/forgot-password");

  return (
    <main className="page">
      <div className="stack" style={{ marginTop: 24 }}>
        <p className="muted" style={{ fontFamily: "var(--serif)", fontSize: 19 }}>
          Shaalvim Library
        </p>
        <h1>Choose a new password</h1>
      </div>
      <div style={{ marginTop: 28 }}>
        <ResetForm />
      </div>
    </main>
  );
}

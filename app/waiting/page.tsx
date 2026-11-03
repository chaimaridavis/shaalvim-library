import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { signOut } from "../sign-out";

export default async function WaitingPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/sign-in");
  if (member.status === "approved") redirect("/");

  return (
    <main className="page">
      <div className="stack" style={{ marginTop: 24 }}>
        <p className="muted" style={{ fontFamily: "var(--serif)", fontSize: 19 }}>
          Shaalvim Library
        </p>
        <h1>Waiting for approval</h1>
        <p>
          Thanks, {member.full_name.split(" ")[0]}. An organizer is reviewing your
          request to join. We&rsquo;ll email you once you&rsquo;re approved, and then
          you&rsquo;ll see everyone&rsquo;s books here.
        </p>
        <form action={signOut}>
          <button type="submit" className="text-link">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}

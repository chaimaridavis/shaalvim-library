import { requireApprovedMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../../sign-out";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const member = await requireApprovedMember();
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("member_contacts")
    .select("email, whatsapp")
    .eq("member_id", member.id)
    .single();
  const { email } = await searchParams;

  return (
    <div className="narrow">
      <h1 style={{ marginBottom: 24 }}>Profile</h1>
      <ProfileForm
        member={member}
        email={contacts?.email ?? ""}
        whatsapp={contacts?.whatsapp ?? ""}
        notice={
          email === "confirmed"
            ? "Thanks. If we sent a confirmation link to your other email address too, open that one as well to finish the change."
            : undefined
        }
      />
      <form action={signOut} style={{ textAlign: "center", marginTop: 16 }}>
        <button type="submit" className="text-link">
          Sign out
        </button>
      </form>
    </div>
  );
}

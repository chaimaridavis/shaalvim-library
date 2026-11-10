import { requireApprovedMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Bell } from "./bell";
import { Menu } from "./menu";

// Everything inside the library: only approved members get this far.
export default async function LibraryLayout({ children }: LayoutProps<"/">) {
  const member = await requireApprovedMember();
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("member_id", member.id)
    .is("read_at", null);
  const unread = count ?? 0;

  return (
    <>
      <main className="page with-menu">{children}</main>
      <Menu isAdmin={member.is_admin} bell={<Bell unread={unread} />} />
      <div className="bell-corner">
        <Bell unread={unread} />
      </div>
    </>
  );
}

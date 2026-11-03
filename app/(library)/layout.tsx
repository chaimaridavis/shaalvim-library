import { requireApprovedMember } from "@/lib/auth";
import { Menu } from "./menu";

// Everything inside the library: only approved members get this far.
export default async function LibraryLayout({ children }: LayoutProps<"/">) {
  const member = await requireApprovedMember();

  return (
    <>
      <main className="page with-menu">{children}</main>
      <Menu isAdmin={member.is_admin} />
    </>
  );
}

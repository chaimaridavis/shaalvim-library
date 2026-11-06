import { NextResponse, type NextRequest } from "next/server";
import { getCurrentMember } from "@/lib/auth";
import { searchCatalog } from "@/lib/catalog";

// Live results for the "Add one book" search box.
export async function GET(request: NextRequest) {
  const member = await getCurrentMember();
  if (member?.status !== "approved") {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const q = request.nextUrl.searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ books: await searchCatalog(q.slice(0, 120)) });
  } catch (error) {
    console.error("catalog search failed", error);
    return NextResponse.json({ books: [], error: "search failed" }, { status: 502 });
  }
}

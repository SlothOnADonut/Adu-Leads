import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getExportRows, toCsv } from "@/lib/export";
import { todayISO } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV for mail merge: /api/export?campaign=<id>&include_sent=1 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const rows = await getExportRows(supabase, request.nextUrl.origin, {
    campaign: sp.get("campaign"),
    includeSent: sp.get("include_sent") === "1",
  });

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="postcard-mail-merge-${todayISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

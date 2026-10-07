import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPostcardExportItems, manifestCsv } from "@/lib/postcards/export";
import type { PostcardStatus } from "@/lib/postcards/data";
import { todayISO } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Postcard export manifest for ONE campaign.
 *   /api/postcards/manifest?campaign=<id>              → approved postcards only (default)
 *   /api/postcards/manifest?campaign=<id>&include=ready → approved + ready (for proofing)
 * Never includes not-ready postcards or "Do not contact" leads.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const campaign = request.nextUrl.searchParams.get("campaign") ?? "";
  if (!UUID_RE.test(campaign)) return NextResponse.json({ error: "Pick a campaign" }, { status: 400 });
  const statuses: PostcardStatus[] = request.nextUrl.searchParams.get("include") === "ready" ? ["approved", "ready"] : ["approved"];

  const items = await getPostcardExportItems(supabase, request.nextUrl.origin, { campaignId: campaign, statuses });
  return new Response(manifestCsv(items), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="postcard-manifest-${todayISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

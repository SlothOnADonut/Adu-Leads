import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canGeneratePostcard, imageAsDataUri, loadPostcardLead, notReadyReason, renderPostcardSide } from "@/lib/postcards/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Self-contained, print-size postcard SVG for one lead (signed-in users only).
 *   /api/postcards/<leadId>/front.svg
 *   /api/postcards/<leadId>/back.svg?address=1   (prints the recipient in the address area)
 *   add &download=1 to save as a file
 * The approved property image is embedded, so the file works offline and can
 * be turned into a 300-DPI PNG in the browser. Refuses (409) unless the image is Approved.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ leadId: string; side: string }> }) {
  const { leadId, side: rawSide } = await params;
  const side = rawSide.replace(/\.svg$/i, "");
  if (!UUID_RE.test(leadId) || (side !== "front" && side !== "back")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const lead = await loadPostcardLead(supabase, leadId);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!canGeneratePostcard(lead)) {
    return NextResponse.json({ error: `Postcard not available: ${notReadyReason(lead)}` }, { status: 409 });
  }

  let imageHref: string;
  try {
    imageHref = await imageAsDataUri(lead.property_image_url!);
  } catch (err) {
    return NextResponse.json(
      { error: `Couldn't load the approved property image: ${err instanceof Error ? err.message : "unknown error"}` },
      { status: 502 }
    );
  }

  const sp = request.nextUrl.searchParams;
  const svg = renderPostcardSide(lead, side, { imageHref, withAddress: sp.get("address") === "1" });
  const suffix = side === "back" && sp.get("address") === "1" ? "back-with-address" : side;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, no-store",
      ...(sp.get("download") === "1" ? { "Content-Disposition": `attachment; filename="${lead.lead_code}-${suffix}.svg"` } : {}),
    },
  });
}

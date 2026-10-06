import { NextResponse, type NextRequest } from "next/server";
import { LEAD_CODE_RE } from "@/lib/constants";
import { qrPng } from "@/lib/qr";
import { trackingUrl } from "@/lib/tracking";

export const runtime = "nodejs";

/**
 * Public QR image: /api/qr/ANA-0001.png?size=600
 * The image only encodes the tracking URL — no homeowner data, and no
 * database lookup — so it is safe to be public (mail-merge tools need it).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode).replace(/\.png$/i, "").toUpperCase();
  if (!LEAD_CODE_RE.test(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const sizeParam = Number(request.nextUrl.searchParams.get("size") || 600);
  const size = Math.min(2000, Math.max(150, Number.isFinite(sizeParam) ? Math.round(sizeParam) : 600));

  const png = await qrPng(trackingUrl(code), size);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition": `inline; filename="${code}.png"`,
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_TOKEN_RE } from "@/lib/constants";
import { qrPng } from "@/lib/qr";
import { trackingUrl } from "@/lib/tracking";

export const runtime = "nodejs";

/**
 * Public QR image: /api/qr/<public_token>.png?size=600
 * Keyed by the random public token (V1.6.2) — sequential lead codes are
 * rejected, so this route can't be used to discover tokens. It only encodes
 * the tracking URL (no database lookup, no homeowner data).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const token = decodeURIComponent(rawCode).replace(/\.png$/i, ""); // case-sensitive
  if (!PUBLIC_TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "Invalid reference" }, { status: 400 });
  }

  const sizeParam = Number(request.nextUrl.searchParams.get("size") || 600);
  const size = Math.min(2000, Math.max(150, Number.isFinite(sizeParam) ? Math.round(sizeParam) : 600));

  const png = await qrPng(trackingUrl(token), size);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition": `inline; filename="qr-${token}.png"`,
    },
  });
}

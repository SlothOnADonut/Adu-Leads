import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getExportRows, toCsv } from "@/lib/export";
import { qrPng } from "@/lib/qr";
import { todayISO } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** ZIP of print-ready QR PNGs (one per lead, named ANA-0001.png) + the mail-merge CSV. */
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

  const zip = new JSZip();
  const folder = zip.folder("qr-codes")!;
  for (const row of rows) {
    folder.file(row.qr_png_filename, await qrPng(row.unique_tracking_url, 1200));
  }
  zip.file("mail-merge.csv", toCsv(rows));

  const content = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return new Response(new Uint8Array(content), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="postcard-qr-codes-${todayISO()}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}

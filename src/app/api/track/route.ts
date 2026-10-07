import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_TOKEN_RE } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUBLIC tracking endpoint. Called by the /adu landing page (or Armando's
 * main website) when someone arrives with ?ref=<public_token>.
 *
 * Security:
 *  - Accepts only a lead code + a few harmless strings.
 *  - Always answers {ok:true}; never reveals whether a code exists or any lead data.
 *  - Uses the service-role key server-side ONLY to call two narrow database
 *    functions (record_lead_visit_by_token / record_lead_cta_by_token). The browser never gets it.
 */

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|linkedin|skype|curl|wget|python|axios|headless|lighthouse/i;

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (process.env.TRACKING_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (origin && allowed.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
  }
  return { Vary: "Origin" };
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request.headers.get("origin"));
  const ok = () => NextResponse.json({ ok: true }, { headers });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return ok();
  }

  // V1.6.2: public tracking accepts ONLY the random public token (?ref=…).
  // Sequential lead codes are ignored here.
  const ref = typeof body.ref === "string" ? body.ref.trim() : "";
  if (!PUBLIC_TOKEN_RE.test(ref)) return ok();

  const userAgent = request.headers.get("user-agent") || "";
  if (BOT_RE.test(userAgent)) return ok();

  const metadata = {
    user_agent: userAgent.slice(0, 300),
    referrer: str(body.referrer, 300),
    page: str(body.page, 120),
    utm_source: str(body.utm_source, 80),
    utm_medium: str(body.utm_medium, 80),
    utm_campaign: str(body.utm_campaign, 80),
  };

  try {
    const supabase = createAdminClient();
    if (body.action === "cta") {
      const cta = typeof body.cta === "string" ? body.cta : "";
      if (["heloc", "book", "call"].includes(cta)) {
        // V1.6: which exact button and where on the page (short, safe identifiers only)
        const slug = (v: unknown) => (typeof v === "string" && /^[a-z_]{1,40}$/.test(v) ? v : undefined);
        const ctaMeta = { ...metadata, button: slug(body.button), placement: slug(body.placement) };
        await supabase.rpc("record_lead_cta_by_token", { p_token: ref, p_cta: cta, p_metadata: ctaMeta });
      }
    } else {
      const source = body.source === "link" || body.source === "direct" ? body.source : "qr";
      await supabase.rpc("record_lead_visit_by_token", { p_token: ref, p_source: source, p_metadata: metadata });
    }
  } catch (err) {
    console.error("tracking failed", err);
  }

  return ok();
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const lead = body?.lead;
    const source = body?.source ?? "qr";
    const metadata = body?.metadata ?? {};

    if (!lead) {
      return NextResponse.json(
        { ok: false, error: "Missing lead code" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("TRACKING CONFIG ERROR:", {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey,
      });

      return NextResponse.json(
        { ok: false, error: "Server tracking configuration missing" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase.rpc("record_lead_visit", {
      p_lead_code: lead,
      p_source: source,
      p_metadata: metadata,
    });

    if (error) {
      console.error("TRACKING RPC ERROR:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    console.log("TRACKING SUCCESS:", {
      lead,
      source,
      data,
    });

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error("TRACKING ROUTE ERROR:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown tracking error",
      },
      { status: 500 }
    );
  }
}
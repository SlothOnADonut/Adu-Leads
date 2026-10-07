import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ownerName } from "@/lib/format";
import { leadQrMatrix } from "./qr";
import { renderPostcardBack, renderPostcardFront, type PostcardInput } from "./render";

export type PostcardStatus = "not_ready" | "ready" | "approved";

export const POSTCARD_LEAD_COLUMNS =
  "id, lead_code, first_name, last_name, owner_name_raw, mailing_address, property_address, city, state, zip, campaign_id, follow_up_status, property_image_url, property_image_status, property_image_source, postcard_status, postcard_approved_at";

export interface PostcardLead {
  id: string;
  lead_code: string;
  first_name: string | null;
  last_name: string | null;
  owner_name_raw: string | null;
  mailing_address: string | null;
  property_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  campaign_id: string | null;
  follow_up_status: string;
  property_image_url: string | null;
  property_image_status: string;
  property_image_source: string | null;
  postcard_status: PostcardStatus;
  postcard_approved_at: string | null;
}

/** The ONLY gate for generating a postcard: the property image must be Approved. */
export function canGeneratePostcard(l: Pick<PostcardLead, "property_image_status" | "property_image_url">): boolean {
  return l.property_image_status === "approved" && !!l.property_image_url;
}

export function notReadyReason(l: Pick<PostcardLead, "property_image_status" | "property_image_url">): string {
  switch (l.property_image_status) {
    case "missing":
      return "No property image yet";
    case "rejected":
      return "Property image was rejected";
    case "approved":
      return l.property_image_url ? "" : "Approved image has no link";
    default:
      return "Property image is waiting for review";
  }
}

/** Recipient block (owner + mailing address, falling back to the property address). */
export function recipientFor(l: PostcardLead): { name: string; lines: string[]; usedPropertyAddress: boolean } {
  const name = ownerName(l) === "Unknown owner" ? "Current Resident" : ownerName(l);
  if (l.mailing_address?.trim()) {
    const parts = l.mailing_address.split(",").map((s) => s.trim()).filter(Boolean);
    const lines = parts.length > 1 ? [parts[0], parts.slice(1).join(", ")] : parts;
    return { name, lines, usedPropertyAddress: false };
  }
  const cityLine = [l.city, [l.state, l.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return { name, lines: [l.property_address ?? "", cityLine].filter(Boolean), usedPropertyAddress: true };
}

export async function loadPostcardLead(supabase: SupabaseClient, leadId: string): Promise<PostcardLead | null> {
  const { data } = await supabase.from("leads").select(POSTCARD_LEAD_COLUMNS).eq("id", leadId).maybeSingle();
  return (data as unknown as PostcardLead) ?? null;
}

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

/** Downloads the approved image so it can be embedded in a self-contained SVG file. */
export async function imageAsDataUri(url: string): Promise<string> {
  const u = new URL(url);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Unsupported image link");
  const res = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(15_000), redirect: "follow" });
  if (!res.ok) throw new Error(`Image link returned HTTP ${res.status}`);
  const type = (res.headers.get("content-type") || "").split(";")[0].trim();
  if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) throw new Error(`Image link is not a JPG/PNG/WebP image (${type || "unknown type"})`);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_IMAGE_BYTES) throw new Error("Image is larger than 12 MB");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) throw new Error("Image is larger than 12 MB");
  return `data:${type};base64,${buf.toString("base64")}`;
}

/**
 * Builds the SVG for one side. Throws if the image isn't approved — a postcard
 * is never generated for a missing / rejected / unreviewed image.
 */
export function renderPostcardSide(
  lead: PostcardLead,
  side: "front" | "back",
  opts: { imageHref?: string; guides?: boolean; withAddress?: boolean; idPrefix?: string } = {}
): string {
  if (!canGeneratePostcard(lead)) throw new Error(`Postcard not available: ${notReadyReason(lead)}`);
  const { qr } = leadQrMatrix(lead.lead_code);
  const input: PostcardInput = {
    leadCode: lead.lead_code,
    city: lead.city,
    imageHref: opts.imageHref ?? lead.property_image_url!,
    qr,
    idPrefix: opts.idPrefix ?? `pc-${lead.lead_code}-${side}`,
    guides: opts.guides,
    recipient: side === "back" && opts.withAddress ? recipientFor(lead) : null,
  };
  return side === "front" ? renderPostcardFront(input) : renderPostcardBack(input);
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ownerName } from "@/lib/format";
import { leadQrMatrix } from "./qr";
import { renderPostcardBack, renderPostcardFront, type PostcardInput } from "./render";

export type PostcardStatus = "not_ready" | "ready" | "approved";

export const POSTCARD_LEAD_COLUMNS =
  "id, lead_code, public_token, first_name, last_name, owner_name_raw, mailing_address, mailing_name, mailing_street, mailing_city, mailing_state, mailing_zip, mailing_complete, property_address, city, state, zip, campaign_id, follow_up_status, property_image_url, property_image_status, property_image_source, postcard_status, postcard_approved_at";

export interface PostcardLead {
  id: string;
  lead_code: string;
  /** Random public token used in the QR URL (V1.6.2). */
  public_token: string;
  first_name: string | null;
  last_name: string | null;
  owner_name_raw: string | null;
  mailing_address: string | null;
  // V1.5 structured mailing fields (mailing_complete is computed by the database)
  mailing_name: string | null;
  mailing_street: string | null;
  mailing_city: string | null;
  mailing_state: string | null;
  mailing_zip: string | null;
  mailing_complete: boolean;
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

/**
 * Can the postcard be DRAWN (preview)? Only with an Approved property image.
 * Drawing is not the same as ready — see isPostcardReady().
 */
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

type MailingFields = Pick<
  PostcardLead,
  "mailing_name" | "first_name" | "last_name" | "owner_name_raw" | "mailing_street" | "mailing_city" | "mailing_state" | "mailing_zip"
>;

/** Recipient name printed on the card (same rule as the database). */
export function recipientName(l: MailingFields): string | null {
  const clean = (v: string | null) => (v ?? "").trim();
  if (clean(l.mailing_name)) return clean(l.mailing_name);
  const fl = `${clean(l.first_name)} ${clean(l.last_name)}`.trim();
  if (fl) return ownerName({ first_name: l.first_name, last_name: l.last_name, owner_name_raw: null });
  if (clean(l.owner_name_raw)) return ownerName({ first_name: null, last_name: null, owner_name_raw: l.owner_name_raw });
  return null;
}

/** Which required mailing pieces are missing (empty list = complete). */
export function missingMailingFields(l: MailingFields): string[] {
  const out: string[] = [];
  if (!recipientName(l)) out.push("recipient name");
  if (!l.mailing_street?.trim()) out.push("mailing street");
  if (!l.mailing_city?.trim()) out.push("mailing city");
  if (!/^[A-Za-z]{2}$/.test(l.mailing_state?.trim() ?? "")) out.push("mailing state");
  if (!/^\d{5}(-?\d{4})?$/.test(l.mailing_zip?.trim() ?? "")) out.push("mailing ZIP");
  return out;
}

/**
 * "Postcard Ready" (V1.5): approved image + link + recipient name + mailing
 * street, city, state, ZIP. Only ready postcards can be approved, downloaded,
 * exported or printed. The database enforces the same rule.
 */
export function isPostcardReady(l: PostcardLead): boolean {
  return canGeneratePostcard(l) && l.mailing_complete === true && missingMailingFields(l).length === 0;
}

/** Recipient block from the lead's MAILING fields only — never the property address. */
export function recipientFor(l: PostcardLead): { name: string; lines: string[] } | null {
  if (missingMailingFields(l).length > 0) return null;
  return {
    name: recipientName(l)!,
    lines: [l.mailing_street!.trim(), `${l.mailing_city!.trim()}, ${l.mailing_state!.trim().toUpperCase()} ${l.mailing_zip!.trim()}`],
  };
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
  const { qr } = leadQrMatrix(lead.public_token); // QR → /adu?ref=<public_token>; "Ref" line on the card stays the internal code
  const input: PostcardInput = {
    leadCode: lead.lead_code,
    city: lead.city,
    imageHref: opts.imageHref ?? lead.property_image_url!,
    qr,
    idPrefix: opts.idPrefix ?? `pc-${lead.lead_code}-${side}`,
    guides: opts.guides,
    recipient: side === "back" && opts.withAddress ? recipientFor(lead) : null,
    mailingMissing: side === "back" && !!opts.withAddress && recipientFor(lead) === null,
  };
  return side === "front" ? renderPostcardFront(input) : renderPostcardBack(input);
}

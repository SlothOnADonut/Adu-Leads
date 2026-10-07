/** Allowed values of leads.property_image_status (enforced by the database). */
export const PROPERTY_IMAGE_STATUSES = ["missing", "fetched", "needs_review", "approved", "rejected", "manual"] as const;
export type PropertyImageStatus = (typeof PROPERTY_IMAGE_STATUSES)[number];

export const PROPERTY_IMAGE_STATUS_LABELS: Record<PropertyImageStatus, string> = {
  missing: "Missing",
  fetched: "Fetched",
  needs_review: "Needs review",
  approved: "Approved",
  rejected: "Rejected",
  manual: "Manual",
};

/** Order used in filters and summaries — the four everyday statuses first. */
export const PROPERTY_IMAGE_FILTER_ORDER: PropertyImageStatus[] = [
  "approved",
  "needs_review",
  "missing",
  "rejected",
  "fetched",
  "manual",
];

export const PROPERTY_IMAGE_SOURCE_LABELS: Record<string, string> = {
  manual: "Pasted URL",
  upload: "Uploaded photo",
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  return PROPERTY_IMAGE_SOURCE_LABELS[source] ?? source;
}

export function isImageStatus(v: unknown): v is PropertyImageStatus {
  return typeof v === "string" && (PROPERTY_IMAGE_STATUSES as readonly string[]).includes(v);
}

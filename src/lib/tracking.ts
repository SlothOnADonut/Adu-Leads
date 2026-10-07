const DEFAULT_BASE = "https://armandofundsloans.com/adu";

export function trackingBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_TRACKING_BASE_URL || DEFAULT_BASE).trim();
}

/**
 * The public URL printed in a lead's QR code (V1.6.2):
 *   https://armandofundsloans.com/adu?ref=<public_token>
 * Uses the lead's random public_token — NEVER the sequential lead_code.
 */
export function trackingUrl(publicToken: string): string {
  const base = trackingBaseUrl();
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}ref=${encodeURIComponent(publicToken)}`;
}

/** Path of this app's public QR image route for a lead (keyed by public_token). */
export function qrImagePath(publicToken: string, size = 600): string {
  return `/api/qr/${encodeURIComponent(publicToken)}.png?size=${size}`;
}

const DEFAULT_BASE = "https://armandofundsloans.com/adu";

export function trackingBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_TRACKING_BASE_URL || DEFAULT_BASE).trim();
}

/** The unique URL printed in a lead's QR code, e.g. https://armandofundsloans.com/adu?lead=ANA-0001 */
export function trackingUrl(leadCode: string): string {
  const base = trackingBaseUrl();
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}lead=${encodeURIComponent(leadCode)}`;
}

/** Path of this app's QR image route for a lead. */
export function qrImagePath(leadCode: string, size = 600): string {
  return `/api/qr/${encodeURIComponent(leadCode)}.png?size=${size}`;
}

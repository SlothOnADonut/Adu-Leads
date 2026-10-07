/**
 * Adds attribution to the Calendly link so a booked call can be matched to the
 * postcard lead (Calendly records utm_* on the scheduled event). utm_content is
 * the lead's PUBLIC token (search it on the Leads page) — never the lead code.
 * Other links (HELOC, application) are left exactly as configured.
 */
export function bookingUrlWithAttribution(base: string, publicToken: string | null): string {
  try {
    const u = new URL(base);
    if (!/(^|\.)calendly\.com$/i.test(u.hostname)) return base;
    u.searchParams.set("utm_source", "postcard");
    u.searchParams.set("utm_medium", "qr");
    u.searchParams.set("utm_campaign", "adu-heloc");
    if (publicToken) u.searchParams.set("utm_content", publicToken);
    return u.toString();
  } catch {
    return base;
  }
}

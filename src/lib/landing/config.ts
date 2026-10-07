/**
 * /adu landing page configuration (V1.6).
 * Everything the marketing team may need to change lives here.
 */

// ---------------------------------------------------------------------
// LINKS — set in .env.local / Vercel (NEXT_PUBLIC_* are public by design)
// ---------------------------------------------------------------------
const clean = (v: string | undefined) => (v && /^https?:\/\//i.test(v.trim()) ? v.trim() : null);

export const LANDING_LINKS = {
  /** Approved HELOC page. If unset, "Explore HELOC Options" scrolls to the HELOC section. */
  heloc: clean(process.env.NEXT_PUBLIC_HELOC_URL),
  /** Armando's Calendly. If unset, "Book a Call" dials Armando. */
  booking: clean(process.env.NEXT_PUBLIC_BOOKING_URL),
  /** Loan application. If unset, the "Start Loan Application" button is hidden. */
  application: clean(process.env.NEXT_PUBLIC_APPLICATION_URL),
};

// ---------------------------------------------------------------------
// IMAGES — put photos in /public/landing/ and set the paths here,
// e.g. "/landing/hero.jpg". Leave null to use the designed fallback panel.
// Use photos you own or have licensed for marketing. Recommended sizes:
//   hero 2400×1600, option cards 1200×900, headshot 800×800 (square).
// ---------------------------------------------------------------------
export const LANDING_IMAGES: {
  heroFallback: string | null;
  garage: string | null;
  detached: string | null;
  junior: string | null;
  headshot: string | null;
} = {
  heroFallback: null, // generic home/ADU photo shown when the visitor has no approved property image
  garage: null,
  detached: null,
  junior: null,
  headshot: null, // Armando's professional headshot — do not use a stand-in photo
};

// ---------------------------------------------------------------------
// PERSONALIZATION
// ---------------------------------------------------------------------
/** City used in "YOUR ___ PROPERTY" when there's no valid lead code. */
export const DEFAULT_CITY = "Anaheim";

// The property address is never loaded or shown on the public page (lead codes
// are sequential, so it would expose the mailing list).

// ---------------------------------------------------------------------
// COMPLIANCE — paste employer-approved text only. Empty = labeled placeholder.
// ---------------------------------------------------------------------
export const COMPLIANCE = {
  mortgageDisclosure: "", // EMPLOYER-APPROVED MORTGAGE DISCLOSURE
  companyNmls: "", // COMPANY NMLS (e.g. "The Mortgage Professionals NMLS #…")
  equalHousing: "", // EQUAL HOUSING DISCLOSURE
  privacyPolicyUrl: "", // PRIVACY POLICY link
};

export const OFFICE = {
  company: "The Mortgage Professionals",
  street: "16901 Bellflower Blvd",
  cityLine: "Bellflower, CA 90706",
};

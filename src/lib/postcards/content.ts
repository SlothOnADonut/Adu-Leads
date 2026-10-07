/**
 * Postcard copy (V1.5). Change wording here — the renderer reads these.
 * Do not add licensing, NMLS or Equal Housing language that hasn't been
 * approved by the employer.
 */

export const FRONT_COPY = {
  kicker: "YOUR PROPERTY MAY HAVE",
  headlineTop: "ADU",
  headlineBottom: "POTENTIAL",
  sub: ["Explore possible options", "+ funding paths"],
  qrCta: ["SCAN TO SEE", "WHAT'S", "POSSIBLE"],
  qrHint: "with your phone camera",
  benefits: ["Extra Living Space", "Rental Income", "Property Value"],
} as const;

export const BACK_COPY = {
  kicker: "ADU CONCEPT IDEAS",
  concepts: [
    { title: "Garage Conversion", text: "Use existing garage space for potential living or rental space." },
    { title: "Detached ADU", text: "A separate backyard unit for family, guests, or potential rental use." },
    { title: "Junior ADU / Addition", text: "A smaller flexible option depending on the property's layout." },
  ],
  headline: ["THINKING ABOUT", "BUILDING AN ADU?"],
  body: "Home equity may be one way to fund the project without replacing your existing first mortgage.",
  cta: "Explore HELOC Options",
  qrLabel: "SCAN TO EXPLORE",
  disclaimer:
    "Conceptual examples only. ADU feasibility depends on property conditions, city requirements, and project review. Financing is subject to lender approval and eligibility.",
} as const;

/**
 * Employer-approved disclosure (e.g. company NMLS, Equal Housing statement).
 * Leave EMPTY until your employer gives you the exact text — while empty, the
 * back shows a clearly labeled placeholder box so it can't be missed in proofing.
 */
export const EMPLOYER_DISCLOSURE = "";

export function disclosurePlaceholderActive(): boolean {
  return EMPLOYER_DISCLOSURE.trim() === "";
}

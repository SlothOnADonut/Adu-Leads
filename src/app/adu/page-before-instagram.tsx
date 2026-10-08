import type { Metadata } from "next";
import { BRAND } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { COMPLIANCE, DEFAULT_CITY, LANDING_IMAGES, LANDING_LINKS, OFFICE, TESTIMONIALS } from "@/lib/landing/config";
import { loadLandingLeadWithReason, normalizePublicToken, type LandingLead, type LeadLookupClient } from "@/lib/landing/lead";
import { bookingUrlWithAttribution } from "@/lib/landing/links";
import TrackVisit from "./TrackVisit";
import CtaButton, { type CtaPlacement } from "./CtaButton";
import LandingImage from "./LandingImage";
import Headshot from "./Headshot";
import { IconArrow, IconCalendar, IconCheck, IconDoc, IconHome, IconKey, IconLock, IconMail, IconPhone, IconPlus } from "./icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Your property may have ADU potential | ${BRAND.name}`,
  description: `Explore possible ADU options and ways to fund the project without replacing your existing first mortgage. ${BRAND.name}, ${BRAND.title}, NMLS ${BRAND.nmls}.`,
  robots: { index: false, follow: false },
};

// ---------------------------------------------------------------------------
// Copy (V1.7). Conservative and non-promissory on purpose â€” run any change
// past compliance before publishing.
// ---------------------------------------------------------------------------

const PROJECT_COSTS = ["Construction", "Materials", "Contractors", "Permits", "Utilities", "Finishing"];

const COMPARISON = [
  {
    key: "heloc",
    icon: IconKey,
    title: "HELOC",
    subtitle: "Home equity line of credit",
    points: [
      "Uses available home equity",
      "Separate from the existing first mortgage",
      "Funds may be accessed as needed, subject to loan terms",
      "Subject to lender approval and eligibility",
    ],
  },
  {
    key: "cashout",
    icon: IconHome,
    title: "Cash-Out Refinance",
    subtitle: "New first mortgage",
    points: [
      "Replaces the existing first mortgage",
      "A new rate applies to the refinanced mortgage balance",
      "May make sense in some situations",
      "Subject to lender approval and eligibility",
    ],
  },
];

const OPTIONS = [
  {
    key: "garage" as const,
    title: "Garage Conversion",
    points: ["Uses existing garage space", "Can create additional living space", "May provide flexibility for family or rental use"],
  },
  {
    key: "detached" as const,
    title: "Detached Backyard ADU",
    points: ["Separate private structure", "Useful for family, guests, or potential rental use", "Depends on lot conditions and local requirements"],
  },
  {
    key: "junior" as const,
    title: "Junior ADU / Addition",
    points: ["Smaller flexible option", "Can work with existing home layouts", "Requirements vary by property"],
  },
];

const STEPS = [
  { title: "Tell us what you're planning", text: "Share a few details about your ADU and financing goals." },
  { title: "Review possible options", text: "Armando can explain what may be available based on your situation." },
  { title: "You decide", text: "Move forward only if an option makes sense for you." },
];

const FAQ = [
  {
    q: "Will checking my options affect my credit?",
    a: "Exploring general information does not necessarily require a credit pull. If a formal application or credit review is needed, Armando can explain that step before it happens.",
  },
  {
    q: "Do I have to refinance my current mortgage?",
    a: "Not necessarily. A HELOC is generally separate from the existing first mortgage, although the right option depends on your situation and eligibility.",
  },
  {
    q: "Can HELOC funds be used for ADU construction?",
    a: "Eligible borrowers may be able to use HELOC proceeds for qualified home-improvement or construction expenses, subject to lender terms and approval.",
  },
  {
    q: "How much equity do I need?",
    a: "Requirements vary by lender, property, credit profile, and loan structure. Armando can help explain what may apply to your situation.",
  },
  {
    q: "What if my ADU is already under construction?",
    a: "You may still have financing options depending on your project stage, equity, and eligibility.",
  },
];

// ---------------------------------------------------------------------------
// Shared styles â€” tap targets are â‰¥48px tall everywhere.
// ---------------------------------------------------------------------------
const BTN = "inline-flex min-h-12 items-center whitespace-nowrap justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-colors duration-150";
const BTN_GOLD = `${BTN} bg-cta text-night shadow-[0_6px_20px_-8px_rgba(232,179,58,0.7)] hover:bg-cta-hover`;
const BTN_OUTLINE_LIGHT = `${BTN} border border-cream/35 text-cream hover:border-cream/70 hover:bg-white/5`;
const BTN_OUTLINE_DARK = `${BTN} border border-forest-900/20 bg-white text-forest-900 hover:border-forest-900/50 hover:bg-forest-900/5`;
const BTN_DARK = `${BTN} bg-forest-900 text-cream hover:bg-forest-800`;

const WRAP = "mx-auto max-w-6xl px-5 sm:px-6";
const SECTION_Y = "py-12 sm:py-16";
const EYEBROW = "text-[11px] font-bold tracking-[0.2em] text-gold-dark sm:text-xs";
const H2 = "mt-2 font-serif text-[1.75rem] leading-[1.15] font-semibold text-forest-900 sm:text-[2.125rem]";
const LEAD_P = "mt-3 max-w-2xl text-base leading-[1.65] text-charcoal-light sm:text-[17px]";

function Placeholder({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-cream/30 px-3 py-2 text-[11px] font-semibold tracking-wide text-cream/55 uppercase">
      Placeholder â€” {label}
    </div>
  );
}

export default async function AduLandingPage({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  // Never throw on bad input: any problem â†’ generic page.
  // V1.6.2: personalization + tracking come ONLY from the random public token (?ref=â€¦).
  // A sequential ?lead=ANA-0001 is ignored â†’ generic page.
  let rawRef: unknown = null;
  try {
    const sp = await searchParams;
    rawRef = Array.isArray(sp.ref) ? sp.ref[0] : sp.ref;
  } catch {
    rawRef = null;
  }
  const publicToken = normalizePublicToken(rawRef); // well-formed token â†’ visit tracking (server re-checks it)
  const result = await loadLandingLeadWithReason(rawRef, () => createAdminClient() as unknown as LeadLookupClient);
  const lead: LandingLead | null = result.lead;
  if (process.env.NODE_ENV !== "production" && result.reason !== "no_code") {
    // Dev-only diagnostics (token prefix + reason only â€” no names, no addresses).
    console.info(`[adu] ref=${publicToken ? `${publicToken.slice(0, 4)}â€¦` : "(invalid)"} â†’ ${result.reason}${result.detail ? ` (${result.detail})` : ""}`);
  }

  const cityName = lead?.city || DEFAULT_CITY;
  const city = cityName.toUpperCase();
  const heroImage = lead?.imageUrl ?? LANDING_IMAGES.heroFallback;
  const heroSource = lead?.imageUrl ? "lead-image" : LANDING_IMAGES.heroFallback ? "fallback-image" : "fallback-panel";
  const personalImage = !!lead?.imageUrl;

  // "Explore Funding Options" â†’ the approved HELOC page (or the funding section if not configured).
  const fundingHref = LANDING_LINKS.heloc ?? "#funding";
  const bookHref = LANDING_LINKS.booking ? bookingUrlWithAttribution(LANDING_LINKS.booking, lead ? publicToken : null) : BRAND.phoneHref;
  const applyHref = LANDING_LINKS.application;

  const cta = (placement: CtaPlacement) => ({ token: publicToken, placement });

  return (
    <div className="min-h-screen bg-cream text-charcoal">
      <TrackVisit token={publicToken} />

      {/* ---------------- Header ---------------- */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-night/95 text-cream backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="min-w-0 leading-tight">
            <div className="truncate font-serif text-[17px] font-semibold">{BRAND.name}</div>
            <div className="truncate text-[11px] text-cream/65">
              {BRAND.title} Â· NMLS {BRAND.nmls}
            </div>
          </div>
          <CtaButton
            href={BRAND.phoneHref}
            cta="call"
            button="call_phone"
            {...cta("header")}
            ariaLabel={`Call Armando at ${BRAND.phone}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cta/60 px-4 text-sm font-semibold text-cta hover:bg-cta hover:text-night"
          >
            <IconPhone className="h-4 w-4" />
            <span className="hidden sm:inline">{BRAND.phone}</span>
            <span className="sm:hidden">Call</span>
          </CtaButton>
        </div>
      </header>

      <main>
        {/* ---------------- 1. Hero ---------------- */}
        <section className="bg-night text-cream">
          <div className="grid lg:min-h-[560px] lg:grid-cols-[1.35fr_1fr]">
            <div
              data-hero-source={heroSource}
              className="relative aspect-[4/3] max-h-[46svh] w-full overflow-hidden sm:aspect-[16/10] sm:max-h-[54svh] lg:aspect-auto lg:max-h-none"
            >
              <LandingImage
                src={heroImage}
                alt={personalImage ? `Your ${cityName} property` : "Southern California home"}
                sizes="(min-width: 1024px) 58vw, 100vw"
                priority
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/75 via-night/5 to-night/25" />
              <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-night/80 px-3.5 py-1.5 text-[11px] font-bold tracking-[0.18em] text-gold-light backdrop-blur sm:bottom-6 sm:left-6 sm:text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-cta" />
                YOUR {city} PROPERTY
              </div>
            </div>

            <div className="relative flex flex-col justify-center border-cta lg:border-l-[3px]">
              <div className="px-5 pt-5 pb-7 sm:px-8 sm:pt-7 lg:px-12 lg:py-12">
                <h1>
                  <span className="block text-[13px] font-semibold tracking-[0.2em] text-cream/80 sm:text-sm">YOUR PROPERTY MAY HAVE</span>
                  <span className="mt-1 block font-serif text-[2.5rem] leading-[1.02] font-semibold text-cta sm:text-[3.25rem]">ADU POTENTIAL</span>
                </h1>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-cream/85 sm:text-base">
                  Explore possible ADU options and ways to fund the project without replacing your existing first mortgage.
                </p>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <CtaButton href={fundingHref} cta="heloc" button="explore_funding" {...cta("hero")} className={BTN_GOLD}>
                    Explore Funding Options <IconArrow />
                  </CtaButton>
                  <CtaButton href={bookHref} cta="book" button="book_call" {...cta("hero")} className={BTN_OUTLINE_LIGHT}>
                    <IconCalendar className="h-4 w-4" /> Book a 15-Minute Call
                  </CtaButton>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4">
                  <CtaButton
                    href={BRAND.phoneHref}
                    cta="call"
                    button="call_phone"
                    {...cta("hero")}
                    className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-cream hover:text-cta"
                  >
                    <IconPhone className="h-4 w-4 text-cta" /> Call Armando Â· {BRAND.phone}
                  </CtaButton>
                </div>
                <p className="mt-1 flex items-center gap-2 text-[13px] text-cream/65">
                  <IconCheck className="h-3.5 w-3.5 text-cta" /> No obligation Â· See what may fit your situation
                </p>

                <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
                  <Headshot size={44} compact />
                  <div className="text-xs leading-snug text-cream/65">
                    <div className="text-sm font-semibold text-cream">{BRAND.name}</div>
                    {BRAND.title} Â· NMLS {BRAND.nmls}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- 2. Why you received this ---------------- */}
        <section aria-labelledby="why-title" className="bg-cream">
          <div className={`${WRAP} pt-6 pb-2 sm:pt-10`}>
            <div className="relative overflow-hidden rounded-2xl border border-cream-300/70 bg-white shadow-[0_10px_30px_-18px_rgba(16,41,28,0.35)]">
              <span className="absolute inset-y-0 left-0 w-1 bg-cta" aria-hidden />
              <div className="grid gap-4 p-5 pl-6 sm:grid-cols-[auto_1fr] sm:gap-6 sm:p-7 sm:pl-8">
                <span className="hidden h-12 w-12 items-center justify-center rounded-xl bg-forest-900 text-cta sm:flex">
                  <IconMail className="h-6 w-6" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h2 id="why-title" className="font-serif text-xl font-semibold text-forest-900 sm:text-2xl">
                      Why did you receive this?
                    </h2>
                    {lead && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-cta/15 px-2.5 py-1 text-[11px] font-bold tracking-[0.12em] text-gold-dark uppercase">
                        <span className="h-1.5 w-1.5 rounded-full bg-cta" /> Prepared for your {cityName} property
                      </span>
                    )}
                  </div>
                  <p className="mt-2 max-w-3xl text-[15px] leading-[1.65] text-charcoal sm:text-base">
                    Public property records indicate recent ADU-related activity for your property. We created this page to show common
                    ADU possibilities and financing paths homeowners may want to explore.
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-sm font-medium text-forest-700">
                    <IconLock className="h-4 w-4 text-gold-dark" /> Your property details remain private on this page.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- 3. The financing need + HELOC vs cash-out ---------------- */}
        <section id="funding" aria-labelledby="funding-title" className="scroll-mt-16 bg-cream">
          <div className={`${WRAP} ${SECTION_Y}`}>
            <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-12">
              <div>
                <div className={EYEBROW}>FUNDING YOUR PROJECT</div>
                <h2 id="funding-title" className={H2}>
                  Building an ADU Can Require Significant Upfront Capital
                </h2>
                <p className={LEAD_P}>
                  Depending on the project, homeowners may need funds for construction, materials, contractors, permits, utilities, or
                  finishing costs.
                </p>
                <ul className="mt-4 flex flex-wrap gap-2" aria-label="Common project costs">
                  {PROJECT_COSTS.map((c) => (
                    <li key={c} className="rounded-full border border-cream-300 bg-white px-3 py-1 text-[13px] font-medium text-charcoal">
                      {c}
                    </li>
                  ))}
                </ul>

                <div className="mt-7 rounded-2xl bg-forest-900 p-5 text-cream sm:p-6">
                  <h3 className="font-serif text-xl font-semibold text-cta sm:text-2xl">A HELOC May Be One Option</h3>
                  <p className="mt-2 text-[15px] leading-[1.65] text-cream/85 sm:text-base">
                    A home equity line of credit may allow eligible homeowners to access available equity while keeping their existing
                    first mortgage in place.
                  </p>
                </div>
              </div>

              <div className="flex flex-col">
                <div className="grid gap-4 md:grid-cols-2">
                  {COMPARISON.map((c) => (
                    <div key={c.key} className="flex flex-col overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-sm">
                      <div className="flex items-center gap-3 border-b border-cream-200 bg-forest-50 px-5 py-4">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-900 text-cta">
                          <c.icon />
                        </span>
                        <div className="leading-tight">
                          <h3 className="text-[15px] font-bold tracking-wide text-forest-900 uppercase">{c.title}</h3>
                          <div className="mt-0.5 text-xs text-charcoal-light">{c.subtitle}</div>
                        </div>
                      </div>
                      <ul className="space-y-2.5 px-5 py-4">
                        {c.points.map((pt) => (
                          <li key={pt} className="flex gap-2.5 text-[15px] leading-snug text-charcoal">
                            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-charcoal-light">
                  The right option depends on your situation and eligibility.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  {LANDING_LINKS.heloc ? (
                    <CtaButton href={LANDING_LINKS.heloc} cta="heloc" button="explore_funding" {...cta("financing")} className={BTN_GOLD}>
                      Explore Funding Options <IconArrow />
                    </CtaButton>
                  ) : (
                    <CtaButton href={bookHref} cta="book" button="book_call" {...cta("financing")} className={BTN_GOLD}>
                      <IconCalendar className="h-4 w-4" /> Book a 15-Minute Call
                    </CtaButton>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- 4. ADU options ---------------- */}
        <section aria-labelledby="options-title" className="bg-white">
          <div className={`${WRAP} ${SECTION_Y}`}>
            <div className={EYEBROW}>ADU IDEAS</div>
            <h2 id="options-title" className={H2}>
              3 ADU Options for Your Property
            </h2>
            <p className={LEAD_P}>Different ways homeowners add space and flexibility to their property.</p>
            <div className="mt-7 grid gap-5 md:grid-cols-3">
              {OPTIONS.map((o, i) => (
                <article key={o.key} className="group overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                  <div className="relative aspect-[4/3] overflow-hidden bg-forest-800 lg:aspect-[5/4]">
                    <LandingImage
                      src={LANDING_IMAGES[o.key]}
                      alt={`${o.title} example`}
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <span className="absolute top-3 left-3 rounded-full bg-night/80 px-2.5 py-1 text-[10px] font-bold tracking-[0.15em] text-cream">
                      CONCEPT 0{i + 1}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-serif text-xl font-semibold text-forest-900">{o.title}</h3>
                    <ul className="mt-3 space-y-2">
                      {o.points.map((pt) => (
                        <li key={pt} className="flex gap-2.5 text-[15px] leading-snug text-charcoal">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cta/20 text-gold-dark">
                            <IconCheck className="h-3 w-3" />
                          </span>
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-4 text-xs text-charcoal-light">
              Conceptual examples only. ADU feasibility depends on property conditions, city requirements, and project review.
            </p>
          </div>
        </section>

        {/* ---------------- 5. Armando ---------------- */}
        <section aria-labelledby="armando-title" className="bg-cream">
          <div className={`${WRAP} ${SECTION_Y}`}>
            <div className="overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-[0_18px_40px_-24px_rgba(16,41,28,0.45)] lg:grid lg:grid-cols-[340px_1fr]">
              <div className="flex items-center gap-4 bg-[radial-gradient(120%_120%_at_0%_0%,#2c5e41_0%,#10291c_60%,#0b1f16_100%)] p-6 text-cream sm:gap-5 sm:p-8 lg:flex-col lg:items-start lg:justify-center">
                <Headshot size={112} />
                <div className="min-w-0">
                  <div className="font-serif text-2xl font-semibold">{BRAND.name}</div>
                  <div className="mt-0.5 text-sm text-cream/75">{BRAND.title}</div>
                  <div className="text-sm text-cream/75">NMLS {BRAND.nmls}</div>
                  <CtaButton
                    href={BRAND.phoneHref}
                    cta="call"
                    button="call_phone"
                    {...cta("armando")}
                    ariaLabel={`Call Armando at ${BRAND.phone}`}
                    className="mt-1 inline-flex min-h-11 items-center gap-2 text-lg font-semibold text-cta hover:text-cta-hover"
                  >
                    <IconPhone className="h-4 w-4" /> {BRAND.phone}
                  </CtaButton>
                  <div className="text-xs text-cream/55">
                    {OFFICE.company} Â· {OFFICE.cityLine}
                  </div>
                </div>
              </div>
              <div className="p-6 sm:p-8 lg:p-10">
                <div className={EYEBROW}>YOUR LOCAL LOAN OFFICER</div>
                <h2 id="armando-title" className={H2}>
                  Talk With Armando, Not a Call Center
                </h2>
                <p className={LEAD_P}>
                  Get a straightforward explanation of available options, estimated payments, and what may make sense for your situation.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <CtaButton href={bookHref} cta="book" button="book_call" {...cta("armando")} className={BTN_GOLD}>
                    <IconCalendar className="h-4 w-4" /> Book a 15-Minute Call
                  </CtaButton>
                  <CtaButton href={BRAND.phoneHref} cta="call" button="call_phone" {...cta("armando")} className={BTN_DARK}>
                    <IconPhone className="h-4 w-4" /> Call Armando
                  </CtaButton>
                  {applyHref && (
                    <CtaButton href={applyHref} cta="heloc" button="start_application" {...cta("armando")} className={BTN_OUTLINE_DARK}>
                      <IconDoc className="h-4 w-4" /> Start Loan Application
                    </CtaButton>
                  )}
                </div>
              </div>
            </div>

            {/* Verified testimonials only (config TESTIMONIALS). Hidden while the list is empty. */}
            {TESTIMONIALS.length > 0 && (
              <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-section="testimonials">
                {TESTIMONIALS.map((t) => (
                  <figure key={t.name + t.quote.slice(0, 20)} className="rounded-2xl border border-cream-200 bg-white p-5">
                    <blockquote className="text-[15px] leading-relaxed text-charcoal">â€œ{t.quote}â€</blockquote>
                    <figcaption className="mt-3 text-sm font-semibold text-forest-900">
                      {t.name}
                      {t.source && <span className="font-normal text-charcoal-light"> Â· {t.source}</span>}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ---------------- 6. What happens next ---------------- */}
        <section aria-labelledby="next-title" className="bg-white">
          <div className={`${WRAP} ${SECTION_Y}`}>
            <div className={EYEBROW}>SIMPLE &amp; LOW-PRESSURE</div>
            <h2 id="next-title" className={H2}>
              What Happens Next?
            </h2>
            <ol className="mt-7 grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4 rounded-2xl border border-cream-200 bg-cream/50 p-5 md:flex-col md:gap-3 md:p-6">
                  <span className="font-serif text-3xl leading-none font-semibold text-gold sm:text-4xl">0{i + 1}</span>
                  <div>
                    <h3 className="text-sm font-bold tracking-wide text-forest-900 uppercase">{s.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-charcoal-light">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6">
              <CtaButton href={bookHref} cta="book" button="book_call" {...cta("next_steps")} className={`${BTN_DARK} w-full sm:w-auto`}>
                <IconCalendar className="h-4 w-4" /> Book a 15-Minute Call
              </CtaButton>
            </div>
          </div>
        </section>

        {/* ---------------- 7. FAQ ---------------- */}
        <section aria-labelledby="faq-title" className="bg-cream">
          <div className={`mx-auto max-w-3xl px-5 sm:px-6 ${SECTION_Y}`}>
            <div className={EYEBROW}>QUESTIONS</div>
            <h2 id="faq-title" className={H2}>
              Frequently Asked Questions
            </h2>
            <div className="mt-6 divide-y divide-cream-200 overflow-hidden rounded-2xl border border-cream-200 bg-white">
              {FAQ.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-left text-[15px] font-semibold text-forest-900 hover:bg-cream/40 sm:text-base [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cta/15 text-gold-dark transition-transform duration-200 group-open:rotate-45">
                      <IconPlus />
                    </span>
                  </summary>
                  <p className="px-5 pb-5 text-[15px] leading-[1.65] text-charcoal-light">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- 8. Final CTA ---------------- */}
        <section className="bg-[radial-gradient(120%_120%_at_80%_0%,#2c5e41_0%,#10291c_55%,#0b1f16_100%)] text-cream">
          <div className="mx-auto max-w-3xl px-5 py-14 text-center sm:px-6 sm:py-16">
            <h2 className="font-serif text-[1.75rem] leading-[1.15] font-semibold sm:text-[2.5rem]">Explore Your ADU Funding Options</h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-cream/80">
              A quick conversation can help you understand what may be available before you make your next construction decision.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <CtaButton href={fundingHref} cta="heloc" button="explore_funding" {...cta("final")} className={BTN_GOLD}>
                Explore Funding Options <IconArrow />
              </CtaButton>
              <CtaButton href={bookHref} cta="book" button="book_call" {...cta("final")} className={BTN_OUTLINE_LIGHT}>
                <IconCalendar className="h-4 w-4" /> Book a 15-Minute Call
              </CtaButton>
            </div>
            <CtaButton
              href={BRAND.phoneHref}
              cta="call"
              button="call_phone"
              {...cta("final")}
              ariaLabel={`Call Armando at ${BRAND.phone}`}
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-xl font-semibold text-cta hover:text-cta-hover"
            >
              <IconPhone className="h-5 w-5" /> {BRAND.phone}
            </CtaButton>
            <p className="mt-2 text-[13px] text-cream/60">No obligation Â· Financing subject to lender approval and eligibility</p>
          </div>
        </section>
      </main>

      {/* ---------------- Footer / compliance ---------------- */}
      <footer className="bg-night text-cream/70">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 pt-10 pb-28 text-sm sm:px-6 md:grid-cols-2 md:pb-10">
          <div className="space-y-1">
            <div className="font-serif text-lg font-semibold text-cream">{BRAND.name}</div>
            <div>{BRAND.title}</div>
            <div>NMLS {BRAND.nmls}</div>
            <div className="pt-2 text-cream/85">{OFFICE.company}</div>
            <div>{OFFICE.street}</div>
            <div>{OFFICE.cityLine}</div>
            <CtaButton href={BRAND.phoneHref} cta="call" button="call_phone" {...cta("footer")} className="inline-flex min-h-11 items-center gap-2 font-semibold text-cta">
              <IconPhone className="h-4 w-4" /> {BRAND.phone}
            </CtaButton>
          </div>
          <div className="space-y-2 text-xs leading-relaxed">
            {COMPLIANCE.mortgageDisclosure ? <p>{COMPLIANCE.mortgageDisclosure}</p> : <Placeholder label="Employer-approved mortgage disclosure" />}
            {COMPLIANCE.companyNmls ? <p>{COMPLIANCE.companyNmls}</p> : <Placeholder label="Company NMLS" />}
            {COMPLIANCE.equalHousing ? <p>{COMPLIANCE.equalHousing}</p> : <Placeholder label="Equal Housing disclosure" />}
            {COMPLIANCE.privacyPolicyUrl ? (
              <a href={COMPLIANCE.privacyPolicyUrl} className="underline hover:text-cream" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
            ) : (
              <Placeholder label="Privacy policy" />
            )}
            <p className="pt-1 text-cream/80">Financing subject to lender approval and eligibility.</p>
          </div>
        </div>
      </footer>

      {/* ---------------- Mobile sticky action bar ---------------- */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-night/95 px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <div className="grid grid-cols-[auto_1fr] gap-2.5">
          <CtaButton
            href={BRAND.phoneHref}
            cta="call"
            button="call_phone"
            {...cta("sticky")}
            ariaLabel={`Call Armando at ${BRAND.phone}`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-cream/30 px-5 text-[15px] font-semibold text-cream"
          >
            <IconPhone className="h-4 w-4 text-cta" /> Call
          </CtaButton>
          <CtaButton href={fundingHref} cta="heloc" button="explore_funding" {...cta("sticky")} className={`${BTN_GOLD} px-4`}>
            Explore Funding Options
          </CtaButton>
        </div>
      </div>
    </div>
  );
}


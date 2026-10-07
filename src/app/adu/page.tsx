import type { Metadata } from "next";
import { BRAND } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { COMPLIANCE, DEFAULT_CITY, LANDING_IMAGES, LANDING_LINKS, OFFICE } from "@/lib/landing/config";
import { loadLandingLeadWithReason, normalizePublicToken, type LandingLead, type LeadLookupClient } from "@/lib/landing/lead";
import { bookingUrlWithAttribution } from "@/lib/landing/links";
import TrackVisit from "./TrackVisit";
import CtaButton from "./CtaButton";
import LandingImage from "./LandingImage";
import Headshot from "./Headshot";
import { IconArrow, IconCalendar, IconCheck, IconDoc, IconFlow, IconHome, IconKey, IconPhone, IconUser } from "./icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Your property may have ADU potential | ${BRAND.name}`,
  description: `Explore possible ADU options and ways to fund the project using your home equity. ${BRAND.name}, ${BRAND.title}, NMLS ${BRAND.nmls}.`,
  robots: { index: false, follow: false },
};

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

const BENEFITS = [
  { icon: IconKey, title: "Access Home Equity", text: "Use available equity for eligible project expenses." },
  { icon: IconHome, title: "Keep Your First Mortgage", text: "A HELOC is separate from your existing first mortgage." },
  { icon: IconFlow, title: "Flexible Access", text: "Borrow from the available line as funds are needed, subject to the loan terms." },
  { icon: IconUser, title: "Personal Guidance", text: "Armando can help explain available options based on your situation." },
];

const STEPS = [
  { title: "Explore", text: "Review possible ADU funding options." },
  { title: "Talk with Armando", text: "Ask questions about your property and financing goals." },
  { title: "Apply if it makes sense", text: "Continue to an application only if you decide the option fits your needs." },
];

// Shared button styles (large tap targets for mobile)
const BTN = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-colors duration-150";
const BTN_GOLD = `${BTN} bg-cta text-night shadow-[0_6px_20px_-8px_rgba(232,179,58,0.7)] hover:bg-cta-hover`;
const BTN_OUTLINE_LIGHT = `${BTN} border border-cream/35 text-cream hover:border-cream/70 hover:bg-white/5`;
const BTN_OUTLINE_DARK = `${BTN} border border-forest-900/20 text-forest-900 hover:border-forest-900/50 hover:bg-forest-900/5`;
const BTN_DARK = `${BTN} bg-forest-900 text-cream hover:bg-forest-800`;

function Placeholder({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-cream/30 px-3 py-2 text-[11px] font-semibold tracking-wide text-cream/55 uppercase">
      Placeholder — {label}
    </div>
  );
}

export default async function AduLandingPage({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  // Never throw on bad input: any problem → generic page.
  // V1.6.2: personalization + tracking come ONLY from the random public token (?ref=…).
  // A sequential ?lead=ANA-0001 is ignored → generic page.
  let rawRef: unknown = null;
  try {
    const sp = await searchParams;
    rawRef = Array.isArray(sp.ref) ? sp.ref[0] : sp.ref;
  } catch {
    rawRef = null;
  }
  const publicToken = normalizePublicToken(rawRef); // well-formed token → visit tracking (server re-checks it)
  const result = await loadLandingLeadWithReason(rawRef, () => createAdminClient() as unknown as LeadLookupClient);
  const lead: LandingLead | null = result.lead;
  if (process.env.NODE_ENV !== "production" && result.reason !== "no_code") {
    // Dev-only diagnostics (code + reason only — no names, no addresses).
    console.info(`[adu] ref=${publicToken ? `${publicToken.slice(0, 4)}…` : "(invalid)"} → ${result.reason}${result.detail ? ` (${result.detail})` : ""}`);
  }

  const city = (lead?.city || DEFAULT_CITY).toUpperCase();
  const heroImage = lead?.imageUrl ?? LANDING_IMAGES.heroFallback;
  const heroSource = lead?.imageUrl ? "lead-image" : LANDING_IMAGES.heroFallback ? "fallback-image" : "fallback-panel";
  const personalImage = !!lead?.imageUrl;

  const helocHref = LANDING_LINKS.heloc ?? "#heloc";
  const bookHref = LANDING_LINKS.booking ? bookingUrlWithAttribution(LANDING_LINKS.booking, lead ? publicToken : null) : BRAND.phoneHref;
  const applyHref = LANDING_LINKS.application;

  const cta = (placement: Parameters<typeof CtaButton>[0]["placement"]) => ({ token: publicToken, placement });

  return (
    <div className="min-h-screen bg-cream text-charcoal">
      <TrackVisit token={publicToken} />

      {/* ---------------- Header ---------------- */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-night/95 text-cream backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="min-w-0 leading-tight">
            <div className="truncate font-serif text-[17px] font-semibold">{BRAND.name}</div>
            <div className="truncate text-[11px] text-cream/65">
              {BRAND.title} · NMLS {BRAND.nmls}
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
          <div className="grid lg:min-h-[620px] lg:grid-cols-[1.45fr_1fr]">
            <div
              data-hero-source={heroSource}
              className="relative aspect-[4/3] max-h-[46svh] w-full overflow-hidden sm:aspect-[16/10] sm:max-h-[56svh] lg:aspect-auto lg:max-h-none"
            >
              <LandingImage
                src={heroImage}
                alt={personalImage ? `Your ${lead?.city ?? ""} property` : "Southern California home"}
                sizes="(min-width: 1024px) 60vw, 100vw"
                priority
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/75 via-night/5 to-night/25" />
              <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-night/80 px-3.5 py-1.5 text-[11px] font-bold tracking-[0.18em] text-gold-light backdrop-blur sm:bottom-6 sm:left-6 sm:text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-cta" />
                YOUR {city} PROPERTY
              </div>
            </div>

            <div className="relative flex flex-col justify-center border-cta lg:border-l-[3px]">
              <div className="px-5 pt-6 pb-8 sm:px-8 lg:px-12 lg:py-14">
                <div className="mb-4 hidden h-[3px] w-10 bg-cta lg:block" />
                <h1>
                  <span className="block text-[13px] font-semibold tracking-[0.2em] text-cream/80 sm:text-sm">YOUR PROPERTY MAY HAVE</span>
                  <span className="mt-1 block font-serif text-[2.6rem] leading-[1.02] font-semibold text-cta sm:text-6xl">
                    ADU POTENTIAL
                  </span>
                </h1>
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-cream/85 sm:text-base">
                  Explore possible ADU options and ways to fund the project using your home equity.
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <CtaButton href={helocHref} cta="heloc" button="explore_heloc" {...cta("hero")} className={BTN_GOLD}>
                    Explore HELOC Options <IconArrow />
                  </CtaButton>
                  <CtaButton href={bookHref} cta="book" button="book_call" {...cta("hero")} className={BTN_OUTLINE_LIGHT}>
                    <IconCalendar className="h-4 w-4" /> Book a Call
                  </CtaButton>
                </div>
                <CtaButton
                  href={BRAND.phoneHref}
                  cta="call"
                  button="call_phone"
                  {...cta("hero")}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-cream hover:text-cta"
                >
                  <IconPhone className="h-4 w-4 text-cta" /> Call Armando · {BRAND.phone}
                </CtaButton>

                <div className="mt-6 border-t border-white/10 pt-4 text-xs leading-relaxed text-cream/65">
                  <span className="font-semibold text-cream/85">{BRAND.name}</span> · {BRAND.title} · NMLS {BRAND.nmls}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- 2. Personalized context (valid lead only) ---------------- */}
        {lead && (
          <section className="border-b border-cream-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="h-8 w-[3px] rounded-full bg-cta" />
                <div className="text-[11px] font-bold tracking-[0.18em] text-gold-dark">
                  YOUR {city} PROPERTY
                </div>
              </div>
              <p className="text-[15px] leading-relaxed text-charcoal sm:flex-1">
                You&apos;re already exploring what an ADU could mean for your property. Now you can also explore potential ways to fund the project.
              </p>
            </div>
          </section>
        )}

        {/* ---------------- 3. ADU options ---------------- */}
        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <div className="text-xs font-bold tracking-[0.2em] text-gold-dark">ADU IDEAS</div>
            <h2 className="mt-2 font-serif text-3xl leading-tight font-semibold text-forest-900 sm:text-4xl">3 ADU Options for Your Property</h2>
            <p className="mt-3 text-base text-charcoal-light">Different ways homeowners add space and flexibility to their property.</p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {OPTIONS.map((o, i) => (
              <article key={o.key} className="group overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <LandingImage src={LANDING_IMAGES[o.key]} alt={`${o.title} example`} sizes="(min-width: 768px) 33vw, 100vw" className="transition-transform duration-500 group-hover:scale-[1.03]" />
                  <span className="absolute top-3 left-3 rounded-full bg-night/80 px-2.5 py-1 text-[10px] font-bold tracking-[0.15em] text-cream">CONCEPT 0{i + 1}</span>
                </div>
                <div className="p-5">
                  <h3 className="font-serif text-xl font-semibold text-forest-900">{o.title}</h3>
                  <ul className="mt-3 space-y-2">
                    {o.points.map((pt) => (
                      <li key={pt} className="flex gap-2.5 text-[15px] leading-snug text-charcoal">
                        <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-cta/20 text-gold-dark">
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
          <p className="mt-5 text-xs text-charcoal-light">
            Conceptual examples only. ADU feasibility depends on property conditions, city requirements, and project review.
          </p>
        </section>

        {/* ---------------- 4. HELOC explanation ---------------- */}
        <section id="heloc" className="scroll-mt-20 bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <div className="text-xs font-bold tracking-[0.2em] text-gold-dark">FUNDING</div>
              <h2 className="mt-2 font-serif text-3xl leading-tight font-semibold text-forest-900 sm:text-4xl">Using Home Equity to Fund an ADU</h2>
              <p className="mt-4 text-base leading-relaxed text-charcoal">
                A HELOC may allow eligible homeowners to access available home equity for project costs while keeping their existing first mortgage in place.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {LANDING_LINKS.heloc && (
                  <CtaButton href={LANDING_LINKS.heloc} cta="heloc" button="explore_heloc" {...cta("heloc")} className={BTN_GOLD}>
                    Explore HELOC Options <IconArrow />
                  </CtaButton>
                )}
                <CtaButton href={bookHref} cta="book" button="book_call" {...cta("heloc")} className={BTN_OUTLINE_DARK}>
                  <IconCalendar className="h-4 w-4" /> Book a Call
                </CtaButton>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {BENEFITS.map((b) => (
                <div key={b.title} className="rounded-2xl border border-cream-200 bg-cream/60 p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-900 text-cta">
                    <b.icon />
                  </span>
                  <h3 className="mt-4 text-sm font-bold tracking-wide text-forest-900 uppercase">{b.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-charcoal-light">{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- 5. Simple process ---------------- */}
        <section className="bg-night text-cream">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20">
            <div className="text-xs font-bold tracking-[0.2em] text-cta">HOW IT WORKS</div>
            <h2 className="mt-2 font-serif text-3xl leading-tight font-semibold sm:text-4xl">See What Your Options Look Like</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                  <span className="font-serif text-4xl font-semibold text-cta">0{i + 1}</span>
                  <h3 className="mt-3 text-sm font-bold tracking-wide uppercase">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-cream/75">{s.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <CtaButton href={helocHref} cta="heloc" button="explore_heloc" {...cta("process")} className={BTN_GOLD}>
                Explore HELOC Options <IconArrow />
              </CtaButton>
              <CtaButton href={bookHref} cta="book" button="book_call" {...cta("process")} className={BTN_OUTLINE_LIGHT}>
                <IconCalendar className="h-4 w-4" /> Book a Call
              </CtaButton>
            </div>
          </div>
        </section>

        {/* ---------------- 6. Armando ---------------- */}
        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20">
          <div className="overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-sm">
            <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[auto_1fr] lg:items-center">
              <Headshot size={128} />
              <div>
                <div className="text-xs font-bold tracking-[0.2em] text-gold-dark">YOUR LOCAL LOAN OFFICER</div>
                <h2 className="mt-1 font-serif text-3xl font-semibold text-forest-900">{BRAND.name}</h2>
                <p className="mt-1 text-[15px] text-charcoal-light">
                  {BRAND.title} · NMLS {BRAND.nmls}
                </p>
                <CtaButton
                  href={BRAND.phoneHref}
                  cta="call"
                  button="call_phone"
                  {...cta("trust")}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 text-lg font-semibold text-forest-800 hover:text-gold-dark"
                >
                  <IconPhone className="h-5 w-5 text-gold-dark" /> {BRAND.phone}
                </CtaButton>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-4">
                <CtaButton href={helocHref} cta="heloc" button="explore_heloc" {...cta("trust")} className={BTN_GOLD}>
                  Explore HELOC Options
                </CtaButton>
                <CtaButton href={bookHref} cta="book" button="book_call" {...cta("trust")} className={BTN_DARK}>
                  <IconCalendar className="h-4 w-4" /> Book a Call
                </CtaButton>
                {applyHref && (
                  <CtaButton href={applyHref} cta="heloc" button="start_application" {...cta("trust")} className={BTN_OUTLINE_DARK}>
                    <IconDoc className="h-4 w-4" /> Start Loan Application
                  </CtaButton>
                )}
                <CtaButton href={BRAND.phoneHref} cta="call" button="call_phone" {...cta("trust")} className={BTN_OUTLINE_DARK}>
                  <IconPhone className="h-4 w-4" /> Call Armando
                </CtaButton>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- 7. Final CTA ---------------- */}
        <section className="bg-[radial-gradient(120%_120%_at_80%_0%,#2c5e41_0%,#10291c_55%,#0b1f16_100%)] text-cream">
          <div className="mx-auto max-w-4xl px-5 py-16 text-center sm:px-6 sm:py-20">
            <h2 className="font-serif text-3xl leading-tight font-semibold sm:text-5xl">Ready to Explore Your ADU Funding Options?</h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-cream/80">See what options may be available for your situation.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <CtaButton href={helocHref} cta="heloc" button="explore_heloc" {...cta("final")} className={BTN_GOLD}>
                Explore HELOC Options <IconArrow />
              </CtaButton>
              <CtaButton href={bookHref} cta="book" button="book_call" {...cta("final")} className={BTN_OUTLINE_LIGHT}>
                <IconCalendar className="h-4 w-4" /> Schedule a Call
              </CtaButton>
            </div>
            <CtaButton
              href={BRAND.phoneHref}
              cta="call"
              button="call_phone"
              {...cta("final")}
              className="mt-6 inline-flex min-h-11 items-center gap-2 text-xl font-semibold text-cta hover:text-cta-hover"
            >
              <IconPhone className="h-5 w-5" /> {BRAND.phone}
            </CtaButton>
          </div>
        </section>
      </main>

      {/* ---------------- 8. Footer / compliance ---------------- */}
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
          <CtaButton href={helocHref} cta="heloc" button="explore_heloc" {...cta("sticky")} className={`${BTN_GOLD} px-4`}>
            Explore HELOC Options
          </CtaButton>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { BRAND, LEAD_CODE_RE } from "@/lib/constants";
import TrackVisit from "./TrackVisit";
import CtaButton from "./CtaButton";

export const metadata: Metadata = {
  title: `Built an ADU? Explore your HELOC options | ${BRAND.name}`,
  description: `${BRAND.name}, ${BRAND.title} at ${BRAND.company}. NMLS #${BRAND.nmls}.`,
  robots: { index: false, follow: false },
};

export default async function AduLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { lead: rawLead } = await searchParams;
  const candidate = typeof rawLead === "string" ? rawLead.trim().toUpperCase() : "";
  const lead = LEAD_CODE_RE.test(candidate) ? candidate : null;

  const helocHref = process.env.NEXT_PUBLIC_HELOC_URL || "#how-it-works";
  const bookHref = process.env.NEXT_PUBLIC_BOOKING_URL || BRAND.phoneHref;

  return (
    <div className="min-h-screen bg-cream text-charcoal">
      <TrackVisit lead={lead} />

      <header className="border-b border-cream-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div>
            <div className="font-serif text-lg font-semibold text-forest-900">{BRAND.name}</div>
            <div className="text-xs text-charcoal-light">
              {BRAND.company} · NMLS #{BRAND.nmls}
            </div>
          </div>
          <CtaButton href={BRAND.phoneHref} cta="call" lead={lead} className="btn-secondary btn-sm">
            {BRAND.phone}
          </CtaButton>
        </div>
      </header>

      <main>
        <section className="bg-forest-900 text-cream">
          <div className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
            <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-gold uppercase">For Southern California ADU owners</p>
            <h1 className="max-w-3xl font-serif text-4xl leading-tight font-semibold sm:text-5xl">
              You added an ADU. Your home may be worth more than you think.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-forest-100">
              A home equity line of credit (HELOC) can let you use that equity — to finish the build, pay off
              construction costs, or keep a cushion for what&apos;s next — without giving up the rate on your first mortgage.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <CtaButton href={helocHref} cta="heloc" lead={lead} className="btn-gold px-6 py-3 text-base">
                Check HELOC Options
              </CtaButton>
              <CtaButton href={bookHref} cta="book" lead={lead} className="btn border border-cream/30 px-6 py-3 text-base text-cream hover:bg-forest-800">
                Book a Call
              </CtaButton>
              <CtaButton href={BRAND.phoneHref} cta="call" lead={lead} className="btn px-6 py-3 text-base text-gold-light underline-offset-4 hover:underline">
                Call Armando · {BRAND.phone}
              </CtaButton>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="font-serif text-2xl font-semibold text-forest-900 sm:text-3xl">How it works</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {[
              ["1", "Quick conversation", "Tell Armando about your home and your ADU project. No cost, no obligation."],
              ["2", "See your options", "Get a clear picture of how much equity you may be able to access and what it would cost."],
              ["3", "Decide on your terms", "If it makes sense, Armando handles the process from application to closing."],
            ].map(([n, title, text]) => (
              <div key={n} className="card p-5">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-gold-light font-serif font-semibold text-gold-dark">{n}</div>
                <h3 className="font-semibold text-forest-900">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-charcoal-light">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto grid max-w-5xl gap-8 px-5 py-16 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-forest-900">Talk to a local loan officer</h2>
              <p className="mt-2 max-w-xl text-charcoal-light">
                {BRAND.name} helps Orange County homeowners understand their equity options in plain English.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <CtaButton href={bookHref} cta="book" lead={lead} className="btn-primary px-6 py-3">
                Book a Call
              </CtaButton>
              <CtaButton href={BRAND.phoneHref} cta="call" lead={lead} className="text-sm font-medium text-forest-700 hover:underline">
                or call {BRAND.phone}
              </CtaButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-cream-200 px-5 py-8 text-xs leading-relaxed text-charcoal-light">
        <div className="mx-auto max-w-5xl space-y-2">
          <p>
            {BRAND.name} · {BRAND.title} · NMLS #{BRAND.nmls} · {BRAND.company} · {BRAND.phone}
          </p>
          <p>
            This is not a commitment to lend. All loans are subject to credit approval, property valuation and
            underwriting guidelines. Terms and availability may change without notice. Equal Housing Opportunity.
          </p>
        </div>
      </footer>
    </div>
  );
}

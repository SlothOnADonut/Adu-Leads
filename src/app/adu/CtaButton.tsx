"use client";

/**
 * A CTA link that also records which button the visitor clicked (no personal data).
 * Uses the existing /api/track → record_lead_cta event. `cta` is the category the
 * database accepts (heloc | book | call); `button` + `placement` add detail in
 * the event's metadata so every click can be attributed to the lead.
 */
export type CtaCategory = "heloc" | "book" | "call";
export type CtaButtonId = "explore_heloc" | "book_call" | "start_application" | "call_phone";
export type CtaPlacement = "header" | "hero" | "heloc" | "process" | "trust" | "final" | "sticky" | "footer";

export default function CtaButton({
  href,
  cta,
  button,
  placement,
  token,
  className,
  children,
  ariaLabel,
}: {
  href: string;
  cta: CtaCategory;
  button: CtaButtonId;
  placement: CtaPlacement;
  /** Public token (?ref=…) — never the internal lead code. */
  token: string | null;
  className: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className={className}
      aria-label={ariaLabel}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={() => {
        let ref = token;
        try {
          ref = ref || sessionStorage.getItem("adu_ref");
        } catch {}
        if (!ref) return;
        const body = JSON.stringify({ ref, action: "cta", cta, button, placement });
        try {
          if (navigator.sendBeacon && navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }))) return;
        } catch {}
        fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
      }}
    >
      {children}
    </a>
  );
}

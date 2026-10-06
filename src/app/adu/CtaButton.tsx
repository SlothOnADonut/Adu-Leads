"use client";

/** A CTA link that also records which button the visitor clicked (no personal data). */
export default function CtaButton({
  href,
  cta,
  lead,
  className,
  children,
}: {
  href: string;
  cta: "heloc" | "book" | "call";
  lead: string | null;
  className: string;
  children: React.ReactNode;
}) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className={className}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={() => {
        let code = lead;
        try {
          code = code || sessionStorage.getItem("adu_lead");
        } catch {}
        if (!code) return;
        const body = JSON.stringify({ lead: code, action: "cta", cta });
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
        } else {
          fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
        }
      }}
    >
      {children}
    </a>
  );
}

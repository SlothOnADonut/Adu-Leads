"use client";

import { useEffect, useRef } from "react";

/** Logs one visit per page load, then removes ?lead= from the address bar so refreshes and shared links don't count again. */
export default function TrackVisit({ lead }: { lead: string | null }) {
  const sent = useRef(false);

  useEffect(() => {
    if (!lead || sent.current) return;
    sent.current = true;

    const params = new URLSearchParams(window.location.search);
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        lead,
        source: params.get("src") === "link" ? "link" : "qr",
        referrer: document.referrer || undefined,
        page: window.location.pathname,
        utm_source: params.get("utm_source") || undefined,
        utm_medium: params.get("utm_medium") || undefined,
        utm_campaign: params.get("utm_campaign") || undefined,
      }),
    }).catch(() => {});

    try {
      sessionStorage.setItem("adu_lead", lead);
    } catch {}
    params.delete("lead");
    params.delete("src");
    const clean = window.location.pathname + (params.toString() ? `?${params.toString()}` : "") + window.location.hash;
    window.history.replaceState(null, "", clean);
  }, [lead]);

  return null;
}

"use client";

import { useEffect, useRef } from "react";

/**
 * Logs one visit per page load using the public token (?ref=…).
 * V1.6.2: the ref stays in the address bar so personalization survives a
 * refresh; the server-side 30-minute dedupe stops refreshes from counting as
 * new scans.
 */
export default function TrackVisit({ token }: { token: string | null }) {
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;

    const params = new URLSearchParams(window.location.search);
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        ref: token,
        source: params.get("src") === "link" ? "link" : "qr",
        referrer: document.referrer || undefined,
        page: window.location.pathname,
        utm_source: params.get("utm_source") || undefined,
        utm_medium: params.get("utm_medium") || undefined,
        utm_campaign: params.get("utm_campaign") || undefined,
      }),
    }).catch(() => {});

    try {
      sessionStorage.setItem("adu_ref", token);
    } catch {}
  }, [token]);

  return null;
}

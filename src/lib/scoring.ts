/**
 * Simple, transparent lead scoring (0–100). Used during import when the
 * CSV doesn't already contain the score. Easy to tweak — change the
 * numbers below and re-import; re-import only updates scores and other
 * enrichment fields, never your notes or statuses.
 */

function monthsBetween(isoDate: string, now: Date): number {
  const d = new Date(isoDate + "T00:00:00Z");
  return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Bigger and more recent ADU permits score higher. */
export function computePermitScore(input: {
  issueDate: string | null;
  valuation: number | null;
  status: string | null;
}, now = new Date()): number {
  let score = 0;

  // Recency: up to 50 points
  if (!input.issueDate) score += 20;
  else {
    const months = monthsBetween(input.issueDate, now);
    if (months <= 6) score += 50;
    else if (months <= 12) score += 40;
    else if (months <= 24) score += 25;
    else score += 10;
  }

  // Job valuation: up to 40 points
  const v = input.valuation;
  if (v === null) score += 10;
  else if (v >= 200000) score += 40;
  else if (v >= 120000) score += 32;
  else if (v >= 75000) score += 24;
  else if (v >= 40000) score += 15;
  else if (v > 0) score += 8;

  // Status: up to 10 points (issued/finaled = real project)
  const s = (input.status || "").toLowerCase();
  if (/(final|complete|issued|approved)/.test(s)) score += 10;
  else if (s) score += 5;

  return clamp(score);
}

/** Longer ownership = more likely to have built equity. */
export function computeEquityScore(lastSaleDate: string | null, now = new Date()): number {
  if (!lastSaleDate) return 50;
  const years = monthsBetween(lastSaleDate, now) / 12;
  if (years >= 15) return 100;
  if (years >= 10) return 85;
  if (years >= 5) return 65;
  if (years >= 2) return 40;
  return 15;
}

/** 60% permit, 40% equity — unless the CSV already provides a priority. */
export function computeFinalScore(permit: number, equity: number, provided: number | null): number {
  if (provided !== null) return clamp(provided);
  return clamp(permit * 0.6 + equity * 0.4);
}

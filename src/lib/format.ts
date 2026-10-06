import { APP_TIMEZONE } from "./constants";
import type { Lead } from "./types";

/** Today's date in Pacific time as YYYY-MM-DD. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Adds days to a YYYY-MM-DD date string. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Formats a YYYY-MM-DD date (no timezone shifting). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return value;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateTime(value).split(",").slice(0, 2).join(",");
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(value < 0.1 && value > 0 ? 1 : 0)}%`;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(Llc|Lp|Ii|Iii|Iv)\b/g, (w) => w.toUpperCase());
}

export function ownerName(lead: Pick<Lead, "first_name" | "last_name" | "owner_name_raw">): string {
  const parts = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
  if (parts) return titleCase(parts);
  if (lead.owner_name_raw) return titleCase(lead.owner_name_raw);
  return "Unknown owner";
}

export function fullPropertyAddress(lead: Pick<Lead, "property_address" | "city" | "state" | "zip">): string {
  const cityLine = [lead.city, [lead.state, lead.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [lead.property_address, cityLine].filter(Boolean).join(", ") || "—";
}

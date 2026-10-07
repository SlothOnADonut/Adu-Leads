import { BRAND } from "@/lib/constants";
import { POSTCARD_SPEC as S } from "./spec";

/**
 * Pure SVG postcard renderer (V1.4). No network, no secrets — given the
 * lead's approved image, QR matrix and text, returns print-size SVG markup.
 *
 * Used for: inline previews (image = public URL), downloadable assets
 * (image = embedded data URI), and the printable PDF pages.
 * 1 SVG unit = 0.01 inch. Canvas = 9.25" × 6.25" (9×6 trim + 0.125" bleed).
 */

export interface QrMatrix {
  size: number;
  /** Row-major, size*size, true = dark module. */
  modules: boolean[];
}

export interface PostcardInput {
  leadCode: string;
  city: string | null;
  /** Approved property image: public URL (inline previews) or data: URI (downloads). */
  imageHref: string;
  qr: QrMatrix;
  /** Unique prefix for SVG ids (several postcards can share one HTML page). */
  idPrefix: string;
  /** Show trim / safe / reserved-area guides (preview only — never in print files). */
  guides?: boolean;
  /** Back only: print the recipient address in the address area (self-mail / verification). */
  recipient?: { name: string; lines: string[] } | null;
}

const C = {
  forest900: "#10291c",
  forest800: "#183a28",
  forest700: "#1f4a32",
  forest500: "#3f7a57",
  cream: "#f7f3ea",
  cream200: "#e8e0cf",
  cream300: "#d9cfba",
  gold: "#b39257",
  goldLight: "#efe5cf",
  charcoal: "#2a2d2b",
  charcoalLight: "#5b605c",
  white: "#ffffff",
};

const SERIF = "Georgia, 'Times New Roman', 'DejaVu Serif', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, 'DejaVu Sans', sans-serif";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Rough word-wrap by estimated glyph width (good enough for fixed copy). */
export function wrap(text: string, maxWidth: number, fontSize: number, factor = 0.52): string[] {
  const maxChars = Math.max(8, Math.floor(maxWidth / (fontSize * factor)));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (!line) line = w;
    else if ((line + " " + w).length <= maxChars) line += " " + w;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function text(
  x: number,
  y: number,
  content: string,
  o: { size: number; family?: string; weight?: number | string; fill?: string; anchor?: "start" | "middle" | "end"; spacing?: number; opacity?: number; style?: string }
): string {
  return `<text x="${x}" y="${y}" font-family="${o.family ?? SANS}" font-size="${o.size}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? C.charcoal}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.spacing ? ` letter-spacing="${o.spacing}"` : ""}${o.opacity !== undefined ? ` fill-opacity="${o.opacity}"` : ""}${o.style ? ` font-style="${o.style}"` : ""}>${esc(content)}</text>`;
}

/** QR code as one <path>, with a 4-module quiet zone, scaled to `px` units square. */
function qrGroup(qr: QrMatrix, x: number, y: number, px: number): string {
  const quiet = 4;
  const total = qr.size + quiet * 2;
  const scale = px / total;
  let d = "";
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.modules[r * qr.size + c]) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return `<g transform="translate(${x} ${y}) scale(${scale.toFixed(5)})" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><path d="${d}" fill="#000"/></g>`;
}

function checkIcon(cx: number, cy: number, r = 10.5): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.gold}"/><path d="M${cx - 4.6} ${cy + 0.2} l3.3 3.4 l6.4 -7" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function guidesSvg(back: boolean): string {
  const t = S.bleedIn * 100;
  const sm = t + S.safeMarginIn * 100;
  let g = `<g pointer-events="none">
  <rect x="${t}" y="${t}" width="${S.canvasW - 2 * t}" height="${S.canvasH - 2 * t}" fill="none" stroke="#e11d48" stroke-width="1" stroke-dasharray="6 4"/>
  <rect x="${sm}" y="${sm}" width="${S.canvasW - 2 * sm}" height="${S.canvasH - 2 * sm}" fill="none" stroke="#0ea5e9" stroke-width="0.8" stroke-dasharray="3 4"/>`;
  if (back) {
    const a = S.addressZone;
    const p = S.postageZone;
    g += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#0ea5e9" fill-opacity="0.06" stroke="#0ea5e9" stroke-dasharray="4 3"/>
  ${text(p.x + p.w / 2, p.y + p.h / 2 + 4, "POSTAGE", { size: 10, anchor: "middle", fill: "#0ea5e9", weight: 700 })}
  <rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="#0ea5e9" fill-opacity="0.04" stroke="#0ea5e9" stroke-dasharray="4 3"/>
  ${text(a.x + a.w - 8, a.y + a.h - 8, "ADDRESS AREA — printer fills", { size: 8, anchor: "end", fill: "#0ea5e9", weight: 700 })}`;
  }
  return g + `</g>`;
}

// ---------------------------------------------------------------------
// FRONT — unique per lead
// ---------------------------------------------------------------------
export function renderPostcardFront(p: PostcardInput): string {
  const id = p.idPrefix;
  const W = S.canvasW;
  const H = S.canvasH;
  const photoW = 540;
  const stripY = 520;
  const px = 568; // right panel content x
  const label = `YOUR ${p.city?.trim() ? p.city.trim().toUpperCase() : ""}${p.city?.trim() ? " " : ""}PROPERTY`;
  const labelW = label.length * 12 * 0.8 + 30;

  const benefits = ["Create Extra Living Space", "Generate Rental Income", "Add Value to Your Property"];
  // three benefits evenly spaced across the cream strip
  const slot = (887.5 - 37.5) / 3;
  const benefitSvg = benefits
    .map((b, i) => {
      const bx = 37.5 + i * slot + (i === 0 ? 0 : 24);
      return `${checkIcon(bx + 11, 571, 11.5)}${text(bx + 31, 575.5, b, { size: 12.5, weight: 600, fill: C.charcoal })}`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${(W / 100).toFixed(2)}in" height="${(H / 100).toFixed(2)}in">
<defs>
  <clipPath id="${id}-photo"><rect x="0" y="0" width="${photoW}" height="${stripY}"/></clipPath>
  <linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.forest900}" stop-opacity="0"/>
    <stop offset="1" stop-color="${C.forest900}" stop-opacity="0.78"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="${C.forest700}"/>
<g clip-path="url(#${id}-photo)">
  <rect width="${photoW}" height="${stripY}" fill="${C.forest800}"/>
  <image href="${esc(p.imageHref)}" xlink:href="${esc(p.imageHref)}" x="0" y="0" width="${photoW}" height="${stripY}" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="${stripY - 150}" width="${photoW}" height="150" fill="url(#${id}-fade)"/>
</g>
<rect x="37.5" y="${stripY - 62}" width="${labelW.toFixed(1)}" height="28" rx="14" fill="${C.forest900}" fill-opacity="0.88"/>
${text(51.5, stripY - 43.5, label, { size: 12, weight: 700, fill: C.gold, spacing: 1.6 })}

<rect x="${photoW}" y="0" width="${W - photoW}" height="${stripY}" fill="${C.forest700}"/>
<rect x="${px}" y="52" width="44" height="3" fill="${C.gold}"/>
${text(px, 96, "YOUR PROPERTY MAY HAVE", { size: 19, weight: 700, fill: C.cream, spacing: 0.8 })}
${text(px, 140, "ADU POTENTIAL", { size: 33, weight: 700, family: SERIF, fill: C.gold })}
${text(px, 176, "Explore possible options + funding paths", { size: 13.5, fill: C.cream, opacity: 0.88 })}

<rect x="${px}" y="206" width="152" height="152" rx="10" fill="#fff"/>
${qrGroup(p.qr, px + 6, 212, 140)}
<path d="M${px + 168} 282 l-12 0 m5 -6 l-6 6 l6 6" fill="none" stroke="${C.gold}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
${text(px + 178, 258, "SCAN TO SEE", { size: 17.5, weight: 800, fill: C.gold, spacing: 0.6 })}
${text(px + 178, 283, "WHAT'S", { size: 17.5, weight: 800, fill: C.gold, spacing: 0.6 })}
${text(px + 178, 308, "POSSIBLE", { size: 17.5, weight: 800, fill: C.gold, spacing: 0.6 })}
${text(px + 178, 334, "Use your phone camera", { size: 9.5, fill: C.cream, opacity: 0.7 })}

<rect x="${px}" y="392" width="${887.5 - px}" height="1" fill="${C.cream}" fill-opacity="0.18"/>
${text(px, 428, BRAND.name, { size: 18, weight: 700, family: SERIF, fill: C.cream })}
${text(px, 449, BRAND.title, { size: 11.5, fill: C.cream, opacity: 0.82 })}
${text(px, 468, `NMLS #${BRAND.nmls}`, { size: 11.5, fill: C.cream, opacity: 0.82 })}
${text(887.5, 468, BRAND.phone, { size: 14, weight: 700, fill: C.gold, anchor: "end" })}
${text(887.5, 500, `Ref ${p.leadCode}`, { size: 8.5, fill: C.cream, opacity: 0.55, anchor: "end", spacing: 0.4 })}

<rect x="0" y="${stripY}" width="${W}" height="${H - stripY}" fill="${C.cream}"/>
<rect x="0" y="${stripY}" width="${W}" height="2.5" fill="${C.gold}"/>
${benefitSvg}
${p.guides ? guidesSvg(false) : ""}
</svg>`;
}

// ---------------------------------------------------------------------
// Generic ADU concept illustrations (original, flat style)
// Each draws inside a 135 × 85 box at (0,0).
// ---------------------------------------------------------------------
function illusBase(): string {
  return `<rect width="135" height="85" fill="#e7eee8"/><circle cx="114" cy="17" r="8" fill="${C.goldLight}"/><rect y="70" width="135" height="15" fill="#c9d8c9"/>`;
}

function illusGarage(): string {
  return `${illusBase()}
  <rect x="14" y="36" width="56" height="34" fill="${C.cream}" stroke="${C.forest700}" stroke-width="1.2"/>
  <path d="M9 38 L42 14 L75 38 Z" fill="${C.forest700}"/>
  <rect x="24" y="46" width="12" height="10" fill="#bcd3dd" stroke="${C.forest700}" stroke-width="0.8"/>
  <rect x="46" y="50" width="12" height="20" fill="${C.forest500}"/>
  <rect x="70" y="44" width="50" height="26" fill="${C.goldLight}" stroke="${C.forest700}" stroke-width="1.2"/>
  <path d="M66 46 L95 30 L124 46 Z" fill="${C.forest800}"/>
  <rect x="76" y="50" width="22" height="12" fill="#bcd3dd" stroke="${C.forest700}" stroke-width="0.8"/>
  <line x1="87" y1="50" x2="87" y2="62" stroke="${C.forest700}" stroke-width="0.8"/>
  <rect x="104" y="52" width="10" height="18" fill="${C.gold}"/>
  <circle cx="112" cy="61" r="0.9" fill="#fff"/>`;
}

function illusDetached(): string {
  return `${illusBase()}
  <rect x="6" y="34" width="54" height="36" fill="${C.cream}" stroke="${C.forest700}" stroke-width="1.2"/>
  <path d="M1 36 L33 12 L65 36 Z" fill="${C.forest700}"/>
  <rect x="15" y="44" width="12" height="10" fill="#bcd3dd" stroke="${C.forest700}" stroke-width="0.8"/>
  <rect x="38" y="50" width="11" height="20" fill="${C.forest500}"/>
  <path d="M49 70 C65 70, 70 76, 88 76" stroke="${C.cream300}" stroke-width="4" fill="none"/>
  <rect x="84" y="48" width="38" height="22" fill="${C.goldLight}" stroke="${C.forest700}" stroke-width="1.2"/>
  <path d="M80 50 L103 36 L126 50 Z" fill="${C.forest800}"/>
  <rect x="89" y="54" width="12" height="8" fill="#bcd3dd" stroke="${C.forest700}" stroke-width="0.8"/>
  <rect x="106" y="55" width="9" height="15" fill="${C.gold}"/>
  <rect x="70" y="46" width="3" height="24" fill="#7a5c3a"/>
  <circle cx="71.5" cy="42" r="9" fill="${C.forest500}"/>`;
}

function illusAddition(): string {
  return `${illusBase()}
  <rect x="14" y="34" width="62" height="36" fill="${C.cream}" stroke="${C.forest700}" stroke-width="1.2"/>
  <path d="M8 36 L45 10 L82 36 Z" fill="${C.forest700}"/>
  <rect x="24" y="44" width="13" height="11" fill="#bcd3dd" stroke="${C.forest700}" stroke-width="0.8"/>
  <rect x="50" y="50" width="12" height="20" fill="${C.forest500}"/>
  <rect x="76" y="46" width="36" height="24" fill="${C.goldLight}" stroke="${C.gold}" stroke-width="1.4" stroke-dasharray="3 2"/>
  <path d="M76 46 L112 40 L112 46 Z" fill="${C.forest800}"/>
  <rect x="84" y="52" width="12" height="9" fill="#bcd3dd" stroke="${C.forest700}" stroke-width="0.8"/>
  <rect x="100" y="54" width="8" height="16" fill="${C.gold}"/>`;
}

// ---------------------------------------------------------------------
// BACK — identical for every lead except the QR (and optional address)
// ---------------------------------------------------------------------
export function renderPostcardBack(p: PostcardInput): string {
  const id = p.idPrefix;
  const W = S.canvasW;
  const H = S.canvasH;
  const lx = 37.5;
  const colW = 432;

  const cards = [
    { title: "GARAGE CONVERSION", bullets: ["Use existing garage space", "Potential living or rental space"], art: illusGarage() },
    { title: "DETACHED ADU", bullets: ["Separate backyard unit", "Potential rental or family use"], art: illusDetached() },
    { title: "JUNIOR ADU / ADDITION", bullets: ["Smaller flexible option", "Depending on property layout"], art: illusAddition() },
  ];

  const cardSvg = cards
    .map((c, i) => {
      const y = 118 + i * 116;
      return `<g transform="translate(${lx} ${y})">
  <rect width="${colW}" height="104" rx="8" fill="#fff" stroke="${C.cream200}"/>
  <clipPath id="${id}-il${i}"><rect x="9" y="9.5" width="135" height="85" rx="6"/></clipPath>
  <g clip-path="url(#${id}-il${i})"><g transform="translate(9 9.5)">${c.art}</g></g>
  <rect x="13" y="78" width="40" height="12" rx="6" fill="${C.forest900}" fill-opacity="0.75"/>
  ${text(33, 86.8, "CONCEPT", { size: 6.5, weight: 700, fill: "#fff", anchor: "middle", spacing: 0.6 })}
  <circle cx="168" cy="27" r="10" fill="${C.gold}"/>
  ${text(168, 31.2, String(i + 1), { size: 12, weight: 700, fill: "#fff", anchor: "middle" })}
  ${text(184, 31.5, c.title, { size: 13.5, weight: 800, fill: C.forest900, spacing: 0.4 })}
  <circle cx="162" cy="${52}" r="2.4" fill="${C.gold}"/>
  ${text(171, 56, c.bullets[0], { size: 11.5, fill: C.charcoal })}
  <circle cx="162" cy="${74}" r="2.4" fill="${C.gold}"/>
  ${text(171, 78, c.bullets[1], { size: 11.5, fill: C.charcoal })}
</g>`;
    })
    .join("\n");

  const disclaimer =
    "Conceptual examples only. ADU feasibility depends on property conditions, city requirements, and project review. Financing is subject to lender approval and eligibility.";
  const discLines = wrap(disclaimer, colW, 8.2, 0.5);

  const rx = 500; // right column x
  const fundBullets = ["Home equity options", "HELOC financing may be available", "Speak with Armando about possible financing paths"];
  let fy = 128;
  const fundSvg = fundBullets
    .map((b) => {
      const lines = wrap(b, 262, 11.5, 0.57);
      const s =
        `<circle cx="${rx + 4}" cy="${fy - 4}" r="2.4" fill="${C.gold}"/>` +
        lines.map((ln, j) => text(rx + 13, fy + j * 15, ln, { size: 11.5, fill: C.charcoal })).join("");
      fy += lines.length * 15 + 6;
      return s;
    })
    .join("");

  const a = S.addressZone;
  const recipientSvg = p.recipient
    ? [p.recipient.name, ...p.recipient.lines]
        .filter(Boolean)
        .slice(0, 5)
        .map((ln, i) => text(a.x + 45, a.y + 95 + i * 17, ln.toUpperCase(), { size: 12.5, fill: C.charcoal, weight: i === 0 ? 700 : 400 }))
        .join("")
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${(W / 100).toFixed(2)}in" height="${(H / 100).toFixed(2)}in">
<rect width="${W}" height="${H}" fill="${C.cream}"/>
<rect x="0" y="0" width="${W}" height="22" fill="${C.forest700}"/>
<rect x="0" y="22" width="${W}" height="2.5" fill="${C.gold}"/>

${text(lx, 74, "3 COMMON ADU OPTIONS", { size: 29, weight: 700, family: SERIF, fill: C.forest900 })}
${text(lx, 99, "Ideas homeowners may explore", { size: 13, fill: C.charcoalLight, style: "italic" })}
${cardSvg}

${text(lx, 492, BRAND.name, { size: 14, weight: 700, family: SERIF, fill: C.forest900 })}
${text(lx, 507, BRAND.company, { size: 10.5, fill: C.charcoal })}
${text(lx, 522, `NMLS #${BRAND.nmls}  ·  ${BRAND.phone}`, { size: 10.5, fill: C.charcoal })}
${discLines.map((ln, i) => text(lx, 549 + i * 11.5, ln, { size: 8.2, fill: C.charcoalLight })).join("")}

<rect x="482" y="40" width="1" height="548" fill="${C.cream300}"/>

${text(rx, 64, "EXPLORE WAYS TO", { size: 20, weight: 700, family: SERIF, fill: C.forest900 })}
${text(rx, 89, "FUND YOUR ADU", { size: 20, weight: 700, family: SERIF, fill: C.gold })}
${fundSvg}

<rect x="${rx}" y="210" width="122" height="122" rx="8" fill="#fff" stroke="${C.cream200}"/>
${qrGroup(p.qr, rx + 5, 215, 112)}
${text(rx + 136, 250, "SCAN TO", { size: 15, weight: 800, fill: C.forest900, spacing: 0.5 })}
${text(rx + 136, 271, "EXPLORE YOUR", { size: 15, weight: 800, fill: C.forest900, spacing: 0.5 })}
${text(rx + 136, 292, "OPTIONS", { size: 15, weight: 800, fill: C.gold, spacing: 0.5 })}
${text(rx + 136, 314, `Ref ${p.leadCode}`, { size: 8.5, fill: C.charcoalLight, spacing: 0.4 })}

${recipientSvg}
${p.guides ? guidesSvg(true) : ""}
</svg>`;
}

import { BRAND } from "@/lib/constants";
import { POSTCARD_SPEC as S } from "./spec";
import { BACK_COPY, EMPLOYER_DISCLOSURE, FRONT_COPY } from "./content";
import { CONCEPT_ART } from "./artwork";

/**
 * Pure SVG postcard renderer (V1.5 design). No network, no secrets.
 * 1 SVG unit = 0.01 inch. Canvas = 9.25" × 6.25" (9×6 trim + 0.125" bleed).
 * Trim line at 12.5 units from each edge; all text/QR kept ≥ 25 units in (safe area).
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
  /** Back only: recipient block printed in the address area. */
  recipient?: { name: string; lines: string[] } | null;
  /** Back only (preview): mailing info incomplete → show a warning in the address area. */
  mailingMissing?: boolean;
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
  goldSoft: "#c9ad78",
  goldLight: "#efe5cf",
  charcoal: "#2a2d2b",
  charcoalLight: "#5b605c",
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

type TextOpts = {
  size: number;
  family?: string;
  weight?: number | string;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  spacing?: number;
  opacity?: number;
  style?: string;
};

function text(x: number, y: number, content: string, o: TextOpts): string {
  return `<text x="${x}" y="${y}" font-family="${o.family ?? SANS}" font-size="${o.size}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? C.charcoal}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.spacing ? ` letter-spacing="${o.spacing}"` : ""}${o.opacity !== undefined ? ` fill-opacity="${o.opacity}"` : ""}${o.style ? ` font-style="${o.style}"` : ""}>${esc(content)}</text>`;
}

/** QR code with a 4-module white quiet zone, scaled to `px` units square. */
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

function check(cx: number, cy: number, r: number, ring: string, tick: string): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ring}"/><path d="M${cx - r * 0.42} ${cy + r * 0.02} l${r * 0.3} ${r * 0.32} l${r * 0.58} -${r * 0.64}" fill="none" stroke="${tick}" stroke-width="${(r * 0.2).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
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
  ${text(a.x + a.w - 8, a.y + a.h - 8, "ADDRESS AREA", { size: 8, anchor: "end", fill: "#0ea5e9", weight: 700 })}`;
  }
  return g + `</g>`;
}

function svgOpen(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${S.canvasW} ${S.canvasH}" width="${(S.canvasW / 100).toFixed(2)}in" height="${(S.canvasH / 100).toFixed(2)}in">`;
}

// ---------------------------------------------------------------------
// FRONT — property photo ≈ 64% of the card, branded panel on the right
// ---------------------------------------------------------------------
export function renderPostcardFront(p: PostcardInput): string {
  const id = p.idPrefix;
  const W = S.canvasW;
  const H = S.canvasH;
  const photoW = 590; // 64% of the width, full height incl. bleed
  const px = 622; // panel content x
  const right = 887.5; // panel content right edge (inside safe area)

  const label = p.city?.trim() ? `YOUR ${p.city.trim().toUpperCase()} PROPERTY` : "YOUR PROPERTY";
  const labelW = label.length * 11 * 0.78 + 30;

  // Benefit row across the bottom of the photo
  let bx = 40;
  const benefits = FRONT_COPY.benefits
    .map((b) => {
      const s = `${check(bx + 9, 576, 9, C.gold, C.forest900)}${text(bx + 24, 580.5, b, { size: 12, weight: 600, fill: C.cream, spacing: 0.2 })}`;
      bx += 24 + b.length * 12 * 0.56 + 30;
      return s;
    })
    .join("");

  return `${svgOpen()}
<defs>
  <clipPath id="${id}-photo"><rect x="0" y="0" width="${photoW}" height="${H}"/></clipPath>
  <linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.forest900}" stop-opacity="0"/>
    <stop offset="0.55" stop-color="${C.forest900}" stop-opacity="0.55"/>
    <stop offset="1" stop-color="${C.forest900}" stop-opacity="0.9"/>
  </linearGradient>
  <linearGradient id="${id}-top" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.forest900}" stop-opacity="0.45"/>
    <stop offset="1" stop-color="${C.forest900}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="${id}-panel" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.forest700}"/>
    <stop offset="1" stop-color="${C.forest900}"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="${C.forest900}"/>

<g clip-path="url(#${id}-photo)">
  <rect width="${photoW}" height="${H}" fill="${C.forest800}"/>
  <image href="${esc(p.imageHref)}" xlink:href="${esc(p.imageHref)}" x="0" y="0" width="${photoW}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="0" width="${photoW}" height="110" fill="url(#${id}-top)"/>
  <rect x="0" y="${H - 175}" width="${photoW}" height="175" fill="url(#${id}-fade)"/>
</g>

<rect x="37.5" y="37.5" width="${labelW.toFixed(1)}" height="27" rx="13.5" fill="${C.forest900}" fill-opacity="0.82"/>
<circle cx="51.5" cy="51" r="3" fill="${C.gold}"/>
${text(60.5, 55, label, { size: 11, weight: 700, fill: C.goldLight, spacing: 1.6 })}

${benefits}

<rect x="${photoW}" y="0" width="${W - photoW}" height="${H}" fill="url(#${id}-panel)"/>
<rect x="${photoW}" y="0" width="3" height="${H}" fill="${C.gold}"/>

<rect x="${px}" y="66" width="34" height="2.5" fill="${C.gold}"/>
${text(px, 98, FRONT_COPY.kicker, { size: 12.5, weight: 600, fill: C.cream, opacity: 0.85, spacing: 1.8 })}
${text(px, 152, FRONT_COPY.headlineTop, { size: 54, weight: 700, family: SERIF, fill: C.cream })}
${text(px, 192, FRONT_COPY.headlineBottom, { size: 36, weight: 700, family: SERIF, fill: C.gold, spacing: 0.5 })}
${text(px, 226, FRONT_COPY.sub[0], { size: 12.5, fill: C.cream, opacity: 0.85 })}
${text(px, 243, FRONT_COPY.sub[1], { size: 12.5, fill: C.cream, opacity: 0.85 })}

<rect x="${px}" y="276" width="134" height="134" rx="9" fill="#fff"/>
${qrGroup(p.qr, px + 6, 282, 122)}
${text(px + 148, 324, FRONT_COPY.qrCta[0], { size: 13.5, weight: 800, fill: C.gold, spacing: 0.8 })}
${text(px + 148, 343, FRONT_COPY.qrCta[1], { size: 13.5, weight: 800, fill: C.gold, spacing: 0.8 })}
${text(px + 148, 362, FRONT_COPY.qrCta[2], { size: 13.5, weight: 800, fill: C.gold, spacing: 0.8 })}
${text(px + 148, 382, FRONT_COPY.qrHint, { size: 8.5, fill: C.cream, opacity: 0.65 })}

<rect x="${px}" y="470" width="${right - px}" height="1" fill="${C.cream}" fill-opacity="0.16"/>
${text(px, 504, BRAND.name, { size: 15, weight: 700, family: SERIF, fill: C.cream })}
${text(px, 522, `${BRAND.title} · NMLS #${BRAND.nmls}`, { size: 9, fill: C.cream, opacity: 0.72 })}
${text(px, 542, BRAND.phone, { size: 11, weight: 700, fill: C.goldSoft, spacing: 0.4 })}
${text(right, 584, `Ref ${p.leadCode}`, { size: 7.5, fill: C.cream, opacity: 0.45, anchor: "end", spacing: 0.4 })}
${p.guides ? guidesSvg(false) : ""}
</svg>`;
}

// ---------------------------------------------------------------------
// BACK — concept cards left; HELOC message, QR, contact + address right
// ---------------------------------------------------------------------
export function renderPostcardBack(p: PostcardInput): string {
  const id = p.idPrefix;
  const W = S.canvasW;
  const H = S.canvasH;
  const lx = 37.5;
  const colW = 430;
  const rx = 500;

  const cards = BACK_COPY.concepts
    .map((c, i) => {
      const y = 72 + i * 144;
      const lines = wrap(c.text, colW - 196 - 14, 10.5, 0.52);
      const art = CONCEPT_ART[i](`${id}-a${i}`);
      return `<g transform="translate(${lx} ${y})">
  <rect width="${colW}" height="134" rx="10" fill="#fff" stroke="${C.cream200}"/>
  <clipPath id="${id}-c${i}"><rect x="8" y="8" width="172" height="118" rx="7"/></clipPath>
  <g clip-path="url(#${id}-c${i})"><g transform="translate(8 8)">${art}</g></g>
  <rect x="14" y="106" width="44" height="13" rx="6.5" fill="${C.forest900}" fill-opacity="0.72"/>
  ${text(36, 115.3, "CONCEPT", { size: 6.5, weight: 700, fill: "#fff", anchor: "middle", spacing: 0.7 })}
  ${text(196, 34, `0${i + 1}`, { size: 9, weight: 700, fill: C.gold, spacing: 1.5 })}
  ${text(196, 56, c.title, { size: 16, weight: 700, family: SERIF, fill: C.forest900 })}
  ${lines.map((ln, j) => text(196, 80 + j * 15, ln, { size: 10.5, fill: C.charcoal })).join("")}
</g>`;
    })
    .join("\n");

  // Employer disclosure: real text if provided, otherwise a labeled placeholder
  const disclosure = EMPLOYER_DISCLOSURE.trim()
    ? wrap(EMPLOYER_DISCLOSURE.trim(), colW, 7.5, 0.5)
        .slice(0, 2)
        .map((ln, i) => text(lx, 516 + i * 10, ln, { size: 7.5, fill: C.charcoalLight }))
        .join("")
    : `<rect x="${lx}" y="505" width="${colW}" height="22" rx="4" fill="none" stroke="${C.charcoalLight}" stroke-opacity="0.55" stroke-dasharray="3 3"/>
${text(lx + colW / 2, 519, "PLACEHOLDER — employer-approved disclosure to be inserted before printing", { size: 7.3, fill: C.charcoalLight, anchor: "middle", spacing: 0.3 })}`;

  const disclaimer = wrap(BACK_COPY.disclaimer, colW, 7.8, 0.5)
    .map((ln, i) => text(lx, 549 + i * 10.5, ln, { size: 7.8, fill: C.charcoalLight }))
    .join("");

  const body = wrap(BACK_COPY.body, 270, 10.5, 0.5)
    .map((ln, i) => text(rx, 124 + i * 15.5, ln, { size: 10.5, fill: C.charcoal }))
    .join("");

  const a = S.addressZone;
  let addressBlock = "";
  if (p.recipient) {
    addressBlock = [p.recipient.name, ...p.recipient.lines]
      .filter(Boolean)
      .slice(0, 4)
      .map((ln, i) => text(a.x + 48, a.y + 92 + i * 18, ln.toUpperCase(), { size: 12.5, fill: C.charcoal, weight: i === 0 ? 700 : 400, spacing: 0.3 }))
      .join("");
  } else if (p.mailingMissing) {
    addressBlock = `<rect x="${a.x + 30}" y="${a.y + 70}" width="${a.w - 60}" height="58" rx="6" fill="#fff7e6" stroke="#d97706" stroke-dasharray="4 3"/>
${text(a.x + a.w / 2, a.y + 96, "MISSING MAILING INFORMATION", { size: 11, weight: 700, fill: "#b45309", anchor: "middle", spacing: 0.6 })}
${text(a.x + a.w / 2, a.y + 113, "Preview only — cannot be approved or printed", { size: 8.5, fill: "#b45309", anchor: "middle" })}`;
  }

  return `${svgOpen()}
<rect width="${W}" height="${H}" fill="${C.cream}"/>
<rect x="0" y="0" width="${W}" height="22" fill="${C.forest700}"/>
<rect x="0" y="22" width="${W}" height="2.5" fill="${C.gold}"/>

${text(lx, 60, BACK_COPY.kicker, { size: 9.5, weight: 700, fill: C.gold, spacing: 2 })}
${cards}
${disclosure}
${disclaimer}

<rect x="482" y="44" width="1" height="544" fill="${C.cream300}"/>

${text(rx, 70, BACK_COPY.headline[0], { size: 19.5, weight: 700, family: SERIF, fill: C.forest900 })}
${text(rx, 95, BACK_COPY.headline[1], { size: 19.5, weight: 700, family: SERIF, fill: C.gold })}
${body}
<rect x="${rx}" y="172" width="184" height="27" rx="13.5" fill="${C.forest700}"/>
${text(rx + 92, 189.5, `${BACK_COPY.cta}  →`, { size: 11, weight: 700, fill: C.cream, anchor: "middle", spacing: 0.3 })}

<rect x="${rx}" y="214" width="118" height="118" rx="8" fill="#fff" stroke="${C.cream200}"/>
${qrGroup(p.qr, rx + 5, 219, 108)}
${text(rx + 132, 236, BACK_COPY.qrLabel, { size: 8.5, weight: 700, fill: C.gold, spacing: 1.4 })}
${text(rx + 132, 262, BRAND.name, { size: 14, weight: 700, family: SERIF, fill: C.forest900 })}
${text(rx + 132, 279, BRAND.company, { size: 9.5, fill: C.charcoal })}
${text(rx + 132, 294, `NMLS ${BRAND.nmls}`, { size: 9.5, fill: C.charcoal })}
${text(rx + 132, 312, BRAND.phone, { size: 11.5, weight: 700, fill: C.forest700, spacing: 0.3 })}
${text(rx + 132, 329, `Ref ${p.leadCode}`, { size: 7.5, fill: C.charcoalLight, spacing: 0.4 })}

${addressBlock}
${p.guides ? guidesSvg(true) : ""}
</svg>`;
}

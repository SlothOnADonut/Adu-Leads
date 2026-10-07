/**
 * Standardized ADU concept artwork for the postcard back (V1.5).
 * Original flat illustrations, identical on every postcard — NOT a rendering
 * of any recipient's property. Each scene draws in a 172 × 118 box at (0,0).
 *
 * To use photos instead later: replace a scene with
 *   `<image href="…/garage.jpg" width="172" height="118" preserveAspectRatio="xMidYMid slice"/>`
 */

const P = {
  sky1: "#eaf1ec",
  sky2: "#f7f3ea",
  hill: "#d6e2d6",
  grass: "#b9cfb3",
  grassDark: "#9dbb98",
  wall: "#fbf8f1",
  wallWarm: "#f3e7cc",
  trim: "#1f4a32",
  roof: "#24513a",
  roofShade: "#183a28",
  roofWarm: "#8f7240",
  window: "#f4dfa8",
  windowFrame: "#ffffff",
  door: "#3f7a57",
  doorWarm: "#b39257",
  path: "#e6dcc6",
  tree: "#5d8c6a",
  treeDark: "#457556",
  trunk: "#7a5c3a",
  fence: "#efe7d6",
};

function backdrop(id: string): string {
  return `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky1}"/><stop offset="1" stop-color="${P.sky2}"/></linearGradient></defs>
<rect width="172" height="118" fill="url(#${id}-sky)"/>
<circle cx="146" cy="22" r="10" fill="#f6e7c1"/>
<path d="M0 78 C30 64 58 70 86 66 C116 62 140 70 172 64 L172 118 L0 118 Z" fill="${P.hill}"/>
<rect y="92" width="172" height="26" fill="${P.grass}"/>
<rect y="92" width="172" height="2" fill="${P.grassDark}"/>`;
}

function tree(x: number, y: number, s = 1): string {
  return `<rect x="${x - 1.6 * s}" y="${y}" width="${3.2 * s}" height="${16 * s}" fill="${P.trunk}"/>
<circle cx="${x}" cy="${y - 4 * s}" r="${11 * s}" fill="${P.tree}"/>
<circle cx="${x + 5 * s}" cy="${y - 1 * s}" r="${7 * s}" fill="${P.treeDark}"/>`;
}

function shrub(x: number, y: number, w = 14): string {
  return `<ellipse cx="${x}" cy="${y}" rx="${w / 2}" ry="${w / 3}" fill="${P.treeDark}"/>`;
}

function win(x: number, y: number, w = 12, h = 10): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${P.window}" stroke="${P.windowFrame}" stroke-width="1.4"/><line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="${P.windowFrame}" stroke-width="1"/>`;
}

/** Main house used in all scenes. */
function house(x: number, y: number, w = 66, h = 34): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${P.wall}"/>
<path d="M${x - 6} ${y + 2} L${x + w / 2} ${y - 22} L${x + w + 6} ${y + 2} Z" fill="${P.roof}"/>
<path d="M${x + w / 2} ${y - 22} L${x + w + 6} ${y + 2} L${x + w / 2} ${y + 2} Z" fill="${P.roofShade}"/>
${win(x + 8, y + 9)}${win(x + w - 20, y + 9)}
<rect x="${x + w / 2 - 6}" y="${y + h - 19}" width="12" height="19" fill="${P.door}"/>`;
}

export function artGarageConversion(id: string): string {
  return `${backdrop(id)}
${tree(18, 66, 0.9)}
${house(26, 58, 62, 34)}
<!-- converted garage: former door is now window + entry -->
<rect x="88" y="66" width="56" height="26" fill="${P.wallWarm}"/>
<path d="M84 68 L116 50 L148 68 Z" fill="${P.roofWarm}"/>
<path d="M116 50 L148 68 L116 68 Z" fill="#7a6136"/>
${win(94, 72, 24, 12)}
<rect x="126" y="72" width="11" height="20" fill="${P.doorWarm}"/>
<circle cx="134.5" cy="82" r="0.9" fill="#fff"/>
<path d="M96 92 L134 92 L140 104 L90 104 Z" fill="${P.path}" opacity="0.9"/>
${shrub(80, 92, 14)}${shrub(150, 92, 12)}`;
}

export function artDetachedAdu(id: string): string {
  return `${backdrop(id)}
${house(14, 58, 62, 34)}
<!-- fence + backyard cottage -->
<g stroke="${P.fence}" stroke-width="2">${Array.from({ length: 9 }, (_, i) => `<line x1="${82 + i * 9}" y1="80" x2="${82 + i * 9}" y2="92"/>`).join("")}<line x1="80" y1="84" x2="160" y2="84"/></g>
${tree(92, 64, 0.95)}
<rect x="112" y="68" width="44" height="24" fill="${P.wallWarm}"/>
<path d="M107 70 L134 52 L161 70 Z" fill="${P.roofWarm}"/>
<path d="M134 52 L161 70 L134 70 Z" fill="#7a6136"/>
${win(118, 74, 12, 9)}
<rect x="138" y="74" width="10" height="18" fill="${P.doorWarm}"/>
<path d="M60 92 C80 96 100 98 140 96 L142 104 C100 106 76 104 56 100 Z" fill="${P.path}" opacity="0.85"/>
${shrub(160, 92, 10)}`;
}

export function artJuniorAdu(id: string): string {
  return `${backdrop(id)}
${tree(150, 66, 0.95)}
${house(18, 56, 70, 36)}
<!-- side addition / junior ADU -->
<rect x="88" y="66" width="40" height="26" fill="${P.wallWarm}"/>
<path d="M88 66 L128 58 L130 66 Z" fill="${P.roofWarm}"/>
<rect x="88" y="64" width="42" height="3" fill="#7a6136"/>
${win(94, 72, 14, 10)}
<rect x="113" y="73" width="10" height="19" fill="${P.doorWarm}"/>
<path d="M110 92 L126 92 L132 104 L106 104 Z" fill="${P.path}" opacity="0.9"/>
${shrub(14, 92, 12)}${shrub(138, 92, 10)}`;
}

export const CONCEPT_ART = [artGarageConversion, artDetachedAdu, artJuniorAdu];

/**
 * Postcard print specification (V1.4).
 *
 * 9" × 6" landscape postcard — a common direct-mail size (USPS "large
 * postcard"/flat-rate depends on your printer; most print-and-mail services
 * offer 6×9). Artwork includes 0.125" bleed on every side.
 *
 * All SVG coordinates use 1 unit = 0.01 inch, so the full canvas with bleed
 * is 925 × 625 units = 9.25" × 6.25".
 */
export const POSTCARD_SPEC = {
  trimWidthIn: 9,
  trimHeightIn: 6,
  bleedIn: 0.125,
  /** Keep text/QR at least this far inside the trim line. */
  safeMarginIn: 0.125,
  dpi: 300,
  /** Canvas incl. bleed, in SVG units (0.01"). */
  canvasW: 925,
  canvasH: 625,
  /** Pixel size of a 300-DPI export incl. bleed. */
  pxW: 2775,
  pxH: 1875,
  /**
   * Back-side areas reserved for the print/mail provider (approximate —
   * confirm against your provider's 6×9 template before printing).
   * Values are in SVG units measured from the canvas top-left (incl. bleed).
   */
  addressZone: { x: 500, y: 350, w: 387.5, h: 237.5 }, // ≈ 3.875" × 2.375", bottom-right
  postageZone: { x: 787.5, y: 37.5, w: 100, h: 100 }, // ≈ 1" × 1", top-right
} as const;

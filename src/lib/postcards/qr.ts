import QRCode from "qrcode";
import type { QrMatrix } from "./render";
import { trackingUrl } from "@/lib/tracking";

/**
 * QR matrix for a lead — encodes the EXISTING tracking URL
 * (e.g. https://armandofundsloans.com/adu?lead=ANA-0001). No new tracking system.
 */
export function leadQrMatrix(leadCode: string): { url: string; qr: QrMatrix } {
  const url = trackingUrl(leadCode);
  const code = QRCode.create(url, { errorCorrectionLevel: "M" });
  const size = code.modules.size;
  const modules: boolean[] = new Array(size * size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) modules[r * size + c] = !!code.modules.get(r, c);
  }
  return { url, qr: { size, modules } };
}

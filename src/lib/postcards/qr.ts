import QRCode from "qrcode";
import type { QrMatrix } from "./render";
import { trackingUrl } from "@/lib/tracking";

/**
 * QR matrix for a lead — encodes the lead's public tracking URL
 * (V1.6.2: https://armandofundsloans.com/adu?ref=<public_token>, never the lead code).
 */
export function leadQrMatrix(publicToken: string): { url: string; qr: QrMatrix } {
  if (!publicToken) throw new Error("Lead has no public token — run the V1.6.2 migration");
  const url = trackingUrl(publicToken);
  const code = QRCode.create(url, { errorCorrectionLevel: "M" });
  const size = code.modules.size;
  const modules: boolean[] = new Array(size * size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) modules[r * size + c] = !!code.modules.get(r, c);
  }
  return { url, qr: { size, modules } };
}

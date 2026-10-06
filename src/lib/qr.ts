import QRCode from "qrcode";

/** Renders a QR code PNG for any URL. */
export async function qrPng(url: string, size = 600): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#111111", light: "#FFFFFF" },
  });
}

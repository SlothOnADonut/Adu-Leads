import Image from "next/image";
import { LANDING_IMAGES } from "@/lib/landing/config";

/**
 * Armando's headshot slot. Set LANDING_IMAGES.headshot (e.g. "/landing/armando.jpg")
 * once the final professional photo arrives. Until then: a monogram — never a
 * stand-in or generated face.
 */
export default function Headshot({ size = 112, compact = false }: { size?: number; compact?: boolean }) {
  const src = LANDING_IMAGES.headshot;
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border-cta/80 bg-forest-800 ${compact ? "border-2" : "border-4 shadow-lg"}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt="Armando Fernandez" fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <div className={`flex h-full w-full items-center justify-center font-serif font-semibold text-cta ${compact ? "text-sm" : "text-3xl"}`} role="img" aria-label="Armando Fernandez">
          AF
        </div>
      )}
    </div>
  );
}

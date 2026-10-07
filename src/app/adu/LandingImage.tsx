import SafeImage from "./SafeImage";
import { isOptimizableImage } from "@/lib/landing/image-hosts";

/**
 * Landing-page photo. Supabase-hosted and local photos go through next/image
 * (allowed by next.config.ts via the same helper); any other host uses a plain
 * <img>. If loading fails, SafeImage retries without optimization.
 * With no src, renders a designed dark panel instead of an empty box.
 */

export default function LandingImage({
  src,
  alt,
  sizes,
  priority = false,
  fallbackLabel,
  className = "",
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  fallbackLabel?: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`absolute inset-0 overflow-hidden bg-[radial-gradient(120%_90%_at_20%_15%,#2c5e41_0%,#163626_45%,#0b1f16_100%)] ${className}`}
      >
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(90deg,#e8b33a_1px,transparent_1px),linear-gradient(#e8b33a_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-night/70 to-transparent" />
        {fallbackLabel && (
          <span className="absolute right-5 bottom-5 left-5 font-serif text-2xl font-semibold leading-tight text-cream/85 sm:text-3xl">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return <SafeImage src={src} alt={alt} sizes={sizes} priority={priority} optimize={isOptimizableImage(src)} className={className} />;
}

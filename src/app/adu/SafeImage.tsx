"use client";

import Image from "next/image";

export default function SafeImage({
  src,
  alt,
  sizes,
  priority,
  optimize,
  className = "",
}: {
  src: string;
  alt: string;
  sizes: string;
  priority: boolean;
  optimize: boolean;
  className?: string;
}) {
  // Local files from /public should render directly and reliably.
  if (src.startsWith("/")) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={`object-cover ${className}`}
      />
    );
  }

  // Remote approved property images.
  if (optimize) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
    />
  );
}
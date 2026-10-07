/**
 * Which image URLs go through Next.js image optimization (next/image).
 * MUST match `images.remotePatterns` in next.config.ts — both use this logic:
 * Supabase public-storage URLs on the project's own host, and local /public files.
 * Everything else is shown with a plain <img> (never rejected).
 */
export const SUPABASE_PUBLIC_STORAGE_PATH = "/storage/v1/object/public/";

export function supabaseStorageHost(supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  try {
    return new URL(supabaseUrl ?? "").hostname || null;
  } catch {
    return null;
  }
}

export function isOptimizableImage(src: string, supabaseUrl?: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  const host = supabaseStorageHost(supabaseUrl);
  if (!host) return false;
  try {
    const u = new URL(src);
    return u.protocol === "https:" && u.hostname === host && u.pathname.startsWith(SUPABASE_PUBLIC_STORAGE_PATH);
  } catch {
    return false;
  }
}

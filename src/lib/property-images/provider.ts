import "server-only";
import { createNearmapProvider } from "./nearmap";

/**
 * Property image providers — the plug-in point for automatic house photos.
 *
 * SERVER ONLY. Providers hold secret API keys, so this module must never be
 * imported by a "use client" component (the "server-only" import enforces it).
 *
 * To add another vendor later: implement PropertyImageProvider in its own
 * file and return it from getPropertyImageProvider(). Everything else (the
 * approval lock, storage, review workflow, bulk UI) stays the same.
 */

export interface PropertyAddress {
  street: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  country?: "US" | "AU";
}

export type PropertyImageFetchResult =
  | {
      kind: "found";
      /** Image file contents — stored in our own Supabase bucket. */
      bytes: Uint8Array;
      contentType: string;
      extension: string;
      /** Saved as property_image_source, e.g. "nearmap". */
      source: string;
      /** Short line for the reviewer: capture date, matched address, confidence. */
      note: string;
      capturedAt?: string;
    }
  | { kind: "not_found"; reason: string }
  | {
      kind: "error";
      reason: string;
      /** true = config problem (bad key, no access); stop a bulk run. */
      fatal?: boolean;
    };

export interface PropertyImageProvider {
  /** Short id saved as the image source. */
  readonly id: string;
  /** Human-readable name shown in the UI. */
  readonly name: string;
  /** Finds the best available image for an address. Never throws. */
  fetchImage(address: PropertyAddress): Promise<PropertyImageFetchResult>;
}

/** The connected provider, or null when none is configured. */
export function getPropertyImageProvider(): PropertyImageProvider | null {
  const nearmapKey = process.env.NEARMAP_API_KEY?.trim();
  if (nearmapKey) return createNearmapProvider(nearmapKey);
  return null;
}

/** Safe-to-share description of the provider (no secrets) for the UI. */
export function getPropertyImageProviderInfo(): { id: string; name: string } | null {
  const p = getPropertyImageProvider();
  return p ? { id: p.id, name: p.name } : null;
}

/** Bulk fetches only fill leads that have no image at all. */
export function shouldAutoFetch(status: string): boolean {
  return status === "missing";
}

/** A single, user-requested fetch may fill any lead whose image is NOT approved. */
export function canFetchSingle(status: string): boolean {
  return status !== "approved";
}

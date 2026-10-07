/**
 * Property image providers — the plug-in point for automatic house photos.
 *
 * V1.2: NO provider is connected. getPropertyImageProvider() returns null,
 * and the "Fetch property images" button stays disabled. Nothing here calls
 * any external service.
 *
 * To add one later (e.g. an aerial/street imagery vendor you have a licence
 * for), create a file that implements PropertyImageProvider, return it from
 * getPropertyImageProvider(), and save results with
 * set_property_image(lead_id, 'set_url', url, provider.id).
 * The database will refuse to overwrite an APPROVED image unless the user
 * explicitly chose Replace, so a bulk fetch can never clobber approved photos.
 */

export interface PropertyAddress {
  street: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  apn?: string | null;
}

export interface PropertyImageResult {
  /** Publicly reachable image URL (or a URL in our own storage bucket). */
  url: string;
  /** Saved as property_image_source, e.g. "nearmap". */
  source: string;
  /** Optional details for the reviewer (capture date, licence notes…). */
  notes?: string;
  capturedAt?: string;
}

export interface PropertyImageProvider {
  /** Short id saved as the image source. */
  readonly id: string;
  /** Human-readable name shown in the UI. */
  readonly name: string;
  /** Returns an image for the address, or null if the provider has none. */
  fetchImage(address: PropertyAddress): Promise<PropertyImageResult | null>;
}

/** The connected provider, or null when none is configured (V1.2: always null). */
export function getPropertyImageProvider(): PropertyImageProvider | null {
  return null;
}

/**
 * Rule every future automated fetch must follow: only fill leads that have
 * no usable image. Approved (and already-under-review) images are skipped.
 */
export function shouldAutoFetch(status: string): boolean {
  return status === "missing" || status === "rejected";
}

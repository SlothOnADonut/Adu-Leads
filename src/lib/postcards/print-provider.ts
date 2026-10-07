import "server-only";
import type { PostcardExportItem } from "./export";

/**
 * Print/mail provider plug-in point (V1.4: NOT connected).
 *
 * A future provider (Lob, Postalytics, PostGrid, a local print shop's API…)
 * implements this interface. It receives the same items as the manifest CSV:
 * recipient, front/back artwork routes (9×6 + 0.125" bleed), and the lead's
 * existing tracking URL. Only postcards with status "approved" should ever be
 * submitted. Nothing in V1.4 sends or mails anything.
 */
export interface PostcardPrintProvider {
  readonly id: string;
  readonly name: string;
  /** Submit approved postcards; return the provider's job/batch reference. */
  submit(items: PostcardExportItem[], opts: { campaignId: string; dryRun?: boolean }): Promise<{ jobId: string; accepted: number }>;
}

export function getPostcardPrintProvider(): PostcardPrintProvider | null {
  return null;
}

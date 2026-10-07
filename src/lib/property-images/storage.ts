import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const PROPERTY_IMAGE_BUCKET = "property-images";

/**
 * Saves image bytes to the "property-images" bucket under a random name and
 * returns its public URL. SERVER ONLY (uses the service key). Creates the
 * bucket if the V1.2 migration couldn't.
 */
export async function storePropertyImage(
  leadId: string,
  bytes: Uint8Array,
  contentType: string,
  extension: string,
  prefix: string
): Promise<{ url: string; path: string } | { error: string }> {
  const admin = createAdminClient();
  const path = `${leadId}/${prefix}-${crypto.randomUUID()}.${extension}`;

  const upload = () =>
    admin.storage.from(PROPERTY_IMAGE_BUCKET).upload(path, bytes, { contentType, upsert: false });

  let { error } = await upload();
  if (error && /bucket not found/i.test(error.message)) {
    const { error: bucketError } = await admin.storage.createBucket(PROPERTY_IMAGE_BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (bucketError && !/already exists/i.test(bucketError.message)) return { error: bucketError.message };
    ({ error } = await upload());
  }
  if (error) return { error: error.message };

  const { data } = admin.storage.from(PROPERTY_IMAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function removePropertyImage(path: string): Promise<void> {
  try {
    await createAdminClient().storage.from(PROPERTY_IMAGE_BUCKET).remove([path]);
  } catch {
    // best effort
  }
}

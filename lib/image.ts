// Client-side image downscale + re-encode, run BEFORE upload to Supabase Storage.
// Operators shoot full-res phone photos (3–12 MB); the public listing then streams those
// originals out of the free-tier egress on every view. Resizing to a sane max dimension and
// re-encoding to JPEG cuts both stored size and egress, with no server/transform cost.
//
// Browser-only (canvas). Never throws and never blocks an upload: on any failure — or if the
// result isn't actually smaller — it returns the original File untouched.
export async function compressImage(
  file: File,
  { maxDim = 1600, quality = 0.8 }: { maxDim?: number; quality?: number } = {},
): Promise<File> {
  if (typeof document === "undefined" || !file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    // Flatten onto white so transparent PNGs don't turn black under JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    // Keep the original if encoding failed or didn't actually save space.
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

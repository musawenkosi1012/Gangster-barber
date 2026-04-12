/**
 * GB-CDN Transform Engine v1.0
 * Optimizes assets for 120Hz display by requesting compressed and resized variants.
 */

export function transformAssetUrl(url: string, width = 600, height = 400): string {
  if (!url) return "/placeholder.jpg";
  if (!url.startsWith("http")) return url.startsWith("/") ? url : `/${url}`;

  // Cloudinary Optimization
  if (url.includes("res.cloudinary.com")) {
    // Inject transformation params after /upload/
    const parts = url.split("/upload/");
    if (parts.length === 2) {
      return `${parts[0]}/upload/c_fill,w_${width},h_${height},q_auto,f_auto/${parts[1]}`;
    }
  }

  // Supabase Optimization (assuming image transformation service is enabled)
  if (url.includes("supabase.co/storage/v1/object/public/")) {
    return `${url}?width=${width}&height=${height}&quality=80`;
  }

  return url;
}

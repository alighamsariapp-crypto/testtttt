const ALLOWED_PROTOCOLS = new Set(["https:", "http:", "mailto:", "tel:"]);

/**
 * لینک‌های مدیر را با یک allow-list باز می‌کند. مسیر نسبی در همان تب باز می‌شود؛
 * URLهای وب در تب جدید و با محافظت noopener/noreferrer باز می‌شوند.
 */
export function openHomepageCustomUrl(value?: string): boolean {
  const url = value?.trim();
  if (!url) return false;

  if (url.startsWith("/") && !url.startsWith("//")) {
    window.location.assign(url);
    return true;
  }

  try {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;

    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      window.open(parsed.toString(), "_blank", "noopener,noreferrer");
    } else {
      window.location.assign(parsed.toString());
    }
    return true;
  } catch {
    return false;
  }
}

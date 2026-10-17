/**
 * The app's public origin, for links that leave the app (WhatsApp messages).
 * APP_BASE_URL wins; on Vercel the production domain is the fallback.
 * Returns null when no usable absolute http(s) URL is configured.
 */
export function appBaseUrl(): URL | null {
  const configured =
    process.env.APP_BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  if (!configured) return null;
  try {
    const url = new URL(configured);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/** Absolute URL for a path on this app, e.g. absoluteAppUrl("/", { approval: id }) */
export function absoluteAppUrl(path: string, params: Record<string, string> = {}): string | null {
  const base = appBaseUrl();
  if (!base) return null;
  // Keep any base path (e.g. https://example.com/office) and replace the rest
  const url = new URL(path.replace(/^\//, ""), base.href.endsWith("/") ? base.href : `${base.href}/`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

/** True for localhost and private-network hosts, which a phone off the LAN can't open */
export function isLocalUrl(url: string): boolean {
  const { hostname } = new URL(url);
  return (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
  );
}

/** Where to send an admin after signing in: only pages inside the admin. */
export function safeAdminNext(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/admin") || /[\\\u0000- \u007f]/.test(value)) return "/admin";
  try {
    const base = "https://admin.invalid";
    const destination = new URL(value, base);
    if (destination.origin !== base) return "/admin";
    if (destination.pathname !== "/admin" && !destination.pathname.startsWith("/admin/")) return "/admin";
    // Never send someone back to the sign-in or password pages.
    if (/^\/admin\/(login|reset-password)\/?$/.test(destination.pathname)) return "/admin";
    return destination.pathname + destination.search;
  } catch {
    return "/admin";
  }
}

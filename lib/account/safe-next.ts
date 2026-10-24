/** Only return canonical, same-origin paths from untrusted auth input. */
export function safeAccountNext(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  ) return "/account";

  try {
    // Also reject encoded slashes/backslashes and controls that another layer
    // might decode before navigating. Ordinary query-string escapes are fine.
    const path = value.split(/[?#]/, 1)[0];
    if (/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(path)) return "/account";
    const base = "https://account.invalid";
    const destination = new URL(value, base);
    if (destination.origin !== base || destination.pathname.startsWith("//")) return "/account";
    // A signed-in visitor is redirected away from these entry pages. Never
    // redirect them straight back to one and create a navigation loop.
    if (/^\/account\/(login|signup|verify)\/?$/.test(destination.pathname)) return "/account";
    return destination.pathname + destination.search + destination.hash;
  } catch {
    return "/account";
  }
}

// Admin invitations arrive with a token fragment, while browser-initiated
// password resets use PKCE. Supabase validates the tokens in either flow.
export function authFlow(pathname: string, hash: string): "implicit" | "pkce" {
  if (pathname !== "/admin/reset-password") return "pkce";
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const type = params.get("type");
  return (type === "invite" || type === "recovery") &&
    Boolean(params.get("access_token")) && Boolean(params.get("refresh_token"))
    ? "implicit"
    : "pkce";
}

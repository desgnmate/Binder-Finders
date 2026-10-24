import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
export function publicClient() {
  if (!configured()) throw new Error("Supabase is not configured");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    },
  );
}
export async function sessionClient() {
  if (!configured()) throw new Error("Supabase is not configured");
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll(values) {
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server Components: refreshed by middleware. */
          }
        },
      },
    },
  );
}
export function serviceClient() {
  if (!process.env.SUPABASE_SECRET_KEY)
    throw new Error("Server database credentials are not configured");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function requireAdmin(owner = false) {
  const db = await sessionClient();
  // Verify the signed access token locally when the project uses asymmetric
  // signing keys. This avoids an Auth /user request on every admin tab change.
  const { data, error } = await db.auth.getClaims();
  const claims = data?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (error || !userId) throw new Error("Please sign in to the admin area");
  const { data: admin } = await db
    .from("admin_users")
    .select("role,active")
    .eq("user_id", userId)
    .single();
  if (!admin?.active || (owner && admin.role !== "owner"))
    throw new Error("You do not have permission to perform this action");
  return {
    db,
    user: {
      id: userId,
      email: typeof claims?.email === "string" ? claims.email : null,
    },
    role: admin.role as "owner" | "editor",
  };
}

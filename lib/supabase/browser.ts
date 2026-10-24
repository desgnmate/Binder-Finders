"use client";
import { createBrowserClient } from "@supabase/ssr";
export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Reset links are completed explicitly in AuthForm. This avoids the SSR
    // browser client attempting to treat an invitation fragment as PKCE.
    { auth: { detectSessionInUrl: false } },
  );
}

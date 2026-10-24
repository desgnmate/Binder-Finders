import { NextRequest, NextResponse } from "next/server";
import { sessionClient } from "../../../lib/supabase/server";
import { safeAccountNext } from "../../../lib/account/safe-next";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeAccountNext(url.searchParams.get("next"));
  if (code) {
    const db = await sessionClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      if (url.searchParams.get("flow") === "recovery") {
        const destination = new URL("/account/reset-password", url.origin);
        if (next !== "/account") destination.searchParams.set("next", next);
        return NextResponse.redirect(destination);
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/account/link-error", url.origin));
}

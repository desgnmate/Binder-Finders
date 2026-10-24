import { NextRequest, NextResponse } from "next/server";
import { sessionClient } from "../../../lib/supabase/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const { error } = await (
      await sessionClient()
    ).auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL("/admin/reset-password", request.url),
      );
  }
  return NextResponse.redirect(new URL("/admin/login?error=link", request.url));
}

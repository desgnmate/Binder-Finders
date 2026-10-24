import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { serviceClient, sessionClient } from "../../../lib/supabase/server";
export const dynamic = "force-dynamic";
const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  note: z.string().max(2000),
  cardIds: z.array(z.string().max(100)).min(1).max(30),
  prices: z.record(z.string(), z.number().int().nonnegative()),
  requestKey: z.string().uuid(),
  website: z.string().max(0),
});
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  if (process.env.CMS_ENABLED !== "true")
    return NextResponse.json(
      { error: "Hold requests are not enabled yet. Please contact the store." },
      { status: 503 },
    );
  const customerDb = await sessionClient();
  const {
    data: { user },
    error: authError,
  } = await customerDb.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: "Sign in to your verified customer account before requesting a hold." },
      { status: 401 },
    );
  }
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Verify your email before requesting a hold." },
      { status: 403 },
    );
  }
  if (Number(req.headers.get("content-length")) > 12000)
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  try {
    const text = await req.text();
    if (text.length > 12000)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const payload = schema.parse(JSON.parse(text));
    const ip = process.env.VERCEL
      ? req.headers.get("x-vercel-forwarded-for") || "unknown"
      : "local";
    const hash = createHmac("sha256", process.env.SUPABASE_SECRET_KEY!)
      .update(ip)
      .digest("hex");
    const { data, error } = await serviceClient().rpc("cms_submit_hold", {
      p_request: payload,
      p_ip_hash: hash,
      p_customer_user_id: user.id,
    });
    if (error) {
      const safe =
        /no longer available|price changed|Too many requests|currently unavailable/.test(
          error.message,
        );
      return NextResponse.json(
        {
          error: safe
            ? error.message
            : "Unable to save your request. Your bag has been kept. Please try again.",
        },
        { status: 409 },
      );
    }
    revalidateTag("store-catalog");
    return NextResponse.json(
      { reference: data },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? "Please check your contact details and selected cards."
            : "Unable to save your request. Please try again.",
      },
      { status: 400 },
    );
  }
}

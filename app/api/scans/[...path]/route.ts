import {
  publicClient,
  requireAdmin,
  serviceClient,
} from "../../../../lib/supabase/server";
export const dynamic = "force-dynamic";
export async function GET(
  _req: Request,
  { params: routeParams }: { params: Promise<{ path: string[] }> },
) {
  const params = await routeParams;
  const path = params.path.join("/");
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path))
    return new Response("Not found", { status: 404 });
  const url = `/api/scans/${path}`;
  const db = publicClient();
  const { data: cards, error } = await db
    .from("cards")
    .select("data")
    .eq("publication", "published");
  if (error) return new Response("Unavailable", { status: 503 });
  const isPublic = cards?.some(
    (c) =>
      c.data.imageUrl === url ||
      c.data.backImageUrl === url ||
      c.data.additionalImages?.includes(url),
  );
  if (!isPublic) {
    try {
      await requireAdmin();
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }
  const { data, error: downloadError } = await serviceClient()
    .storage.from("card-scans")
    .download(path);
  if (downloadError || !data) return new Response("Not found", { status: 404 });
  return new Response(data, {
    headers: {
      "Content-Type": data.type,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

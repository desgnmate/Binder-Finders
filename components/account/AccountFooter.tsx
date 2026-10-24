import { SiteFooter } from "../footer/SiteFooter";
import { publicClient } from "../../lib/supabase/server";
import { defaultContent, contentSchema } from "../../lib/cms/types";

// Stream the footer independently. Account pages don't need the entire shop
// catalog or a cart provider just to render the store's contact information.
export async function AccountFooter() {
  let content = defaultContent;
  if (process.env.CMS_ENABLED === "true") {
    try {
      const { data, error } = await publicClient().from("store_settings").select("data").eq("id", true).abortSignal(AbortSignal.timeout(2500)).single();
      const parsed = contentSchema.safeParse(data?.data?.content);
      if (!error && parsed.success) content = parsed.data;
    } catch {
      // Contact defaults remain useful while the settings service is offline.
    }
  }
  return <SiteFooter content={content} />;
}

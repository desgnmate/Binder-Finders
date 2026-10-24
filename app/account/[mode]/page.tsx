import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { CustomerAuthForm, type CustomerMode } from "../../../components/account/CustomerAuthForm";
import { safeAccountNext } from "../../../lib/account/safe-next";
import { sessionClient } from "../../../lib/supabase/server";

export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { mode } = await params;
  if (!["login", "signup", "forgot-password", "reset-password", "verify"].includes(mode)) notFound();
  const email = mode === "verify" ? (await cookies()).get("customer-pending-email")?.value : undefined;
  const next = safeAccountNext((await searchParams).next);
  if (mode === "login" || mode === "signup" || mode === "verify") {
    const db = await sessionClient();
    const { data: { user } } = await db.auth.getUser();
    if (user?.email_confirmed_at) redirect(next);
  }
  return <CustomerAuthForm mode={mode as CustomerMode} email={email} next={next} />;
}

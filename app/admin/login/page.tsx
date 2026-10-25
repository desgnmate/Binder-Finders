import { AuthForm } from "../../../components/admin/AuthForm";
import { configured } from "../../../lib/supabase/server";
export default async function LoginPage({
  searchParams: query,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const searchParams = await query;
  return (
    <>
      {searchParams.error === "access" && (
        <div role="alert" className="cms-banner" data-tone="warning">
          Your account does not have administrator access. Ask the store owner
          to grant access.
        </div>
      )}
      {configured() ? (
        <AuthForm />
      ) : (
        <div className="cms-auth">
          <div className="cms-auth-box">
            <h1>Admin setup needed</h1>
            <p>
              Supabase environment settings must be configured before signing
              in.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

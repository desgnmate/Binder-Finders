import { Suspense } from "react";
import { AccountFooter } from "../../components/account/AccountFooter";
import { AccountShell } from "../../components/account/AccountShell";
import "./account.css";

export const metadata = {
  title: "My account | BinderFinders",
  robots: { index: false, follow: false },
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccountShell footer={<Suspense fallback={null}><AccountFooter /></Suspense>}>{children}</AccountShell>
  );
}

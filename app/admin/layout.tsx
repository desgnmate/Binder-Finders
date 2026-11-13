import type { Metadata } from "next";
import localFont from "next/font/local";
import "./admin.css";
// Bundled like the storefront fonts in app/layout.tsx; see app/fonts/README.md.
const jakarta = localFont({
  src: "../fonts/PlusJakartaSans-200-800-latin.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-admin",
});
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`cms ${jakarta.variable}`}>{children}</div>;
}

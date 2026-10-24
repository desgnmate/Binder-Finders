import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./admin.css";
const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-admin",
});
export const metadata: Metadata = {
  title: "Admin · BinderFinders",
  robots: { index: false, follow: false },
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`cms ${outfit.variable}`}>{children}</div>;
}

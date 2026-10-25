import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./admin.css";
const jakarta = Plus_Jakarta_Sans({
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
  return <div className={`cms ${jakarta.variable}`}>{children}</div>;
}

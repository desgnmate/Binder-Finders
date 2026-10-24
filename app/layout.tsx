import type { Metadata } from "next";
import { Press_Start_2P, Fredoka, Rammetto_One } from "next/font/google";
import "./globals.css";
import "./responsive.css";

// Stock and prices must reflect the database, never a build-time snapshot.
export const dynamic = "force-dynamic";

const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-retro-proxy",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-body-proxy",
});

const rammetto = Rammetto_One({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-heading-proxy",
});

export const metadata: Metadata = {
  title: "BinderFinders — Home of Vintage Pokemon Cards",
  description:
    "Browse our collection of graded and raw Hoenn-era collectibles from Binders to Gem Mint Singles. Flatbed scanned, certified centering.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${pressStart.variable} ${fredoka.variable} ${rammetto.variable}`}
    >
      <body className="font-body antialiased">
        {children}
      </body>
    </html>
  );
}

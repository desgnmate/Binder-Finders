import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./responsive.css";

// Stock and prices must reflect the database, never a build-time snapshot.
export const dynamic = "force-dynamic";

// Fonts ship with the app (latin subsets from Google Fonts, SIL OFL) so a
// build never depends on fetching them from Google.
const pressStart = localFont({
  src: "./fonts/PressStart2P-Regular-latin.woff2",
  weight: "400",
  display: "swap",
  variable: "--font-retro-proxy",
});

const fredoka = localFont({
  src: "./fonts/Fredoka-400-600-latin.woff2",
  weight: "400 600",
  display: "swap",
  variable: "--font-body-proxy",
});

const rammetto = localFont({
  src: "./fonts/RammettoOne-Regular-latin.woff2",
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

import type { Metadata } from "next";
import { Press_Start_2P, Fredoka } from "next/font/google";
import "./globals.css";
import { RetroButtonSfx } from "../components/RetroButtonSfx";
import { MusicProvider } from "../components/MusicContext";
import { BagProvider } from "../components/bag/BagContext";
import { MusicToggle } from "../components/MusicToggle";

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

// TAN st. Canard is self-hosted via @font-face in globals.css.
// The CSS variable --font-headline points to 'TAN st. Canard' directly.

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
      className={`${pressStart.variable} ${fredoka.variable}`}
    >
      <body className="font-body antialiased">
        <MusicProvider>
          <BagProvider>
            {children}
            <MusicToggle />
            <RetroButtonSfx />
          </BagProvider>
        </MusicProvider>
      </body>
    </html>
  );
}

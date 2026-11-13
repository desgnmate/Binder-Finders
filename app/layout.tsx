import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./responsive.css";
import { DEFAULT_TITLE, SITE_NAME, isIndexable, pageMetadata, siteUrl } from "../lib/seo";

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

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(siteUrl()),
    applicationName: SITE_NAME,
    // No path: a canonical set here would be inherited by every page and
    // point them all at the home page. Each public page sets its own.
    ...pageMetadata({ title: DEFAULT_TITLE, absoluteTitle: true }),
    // Pages name themselves; the template adds the brand after.
    title: { default: DEFAULT_TITLE, template: `%s | ${SITE_NAME}` },
    robots: isIndexable()
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } }
      : { index: false, follow: false },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${pressStart.variable} ${fredoka.variable} ${rammetto.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Lets CSS hide page intros until GSAP plays them, only when motion is allowed. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('motion-ok')}catch(e){}",
          }}
        />
      </head>
      <body className="font-body antialiased">
        {children}
      </body>
    </html>
  );
}

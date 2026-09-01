import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Big_Shoulders } from "next/font/google";
import { DESIGN_SKRIPT, STANDARD_DESIGN } from "@/lib/design";
import "./globals.css";
import "./themes/klassisch.css";
import "./themes/noir.css";

/*
 * Die Schriften des Noir-Designs. Klassisch nutzt weiter die Systemschrift.
 * Google führt die Familie inzwischen als "Big Shoulders" statt
 * "Big Shoulders Display" - der Schnitt ist derselbe.
 */
const anzeige = Big_Shoulders({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--f-display-noir",
  display: "swap",
  fallback: ["Impact", "Haettenschweiler", "system-ui", "sans-serif"],
  // Für diese Familie kennt Next keine Ersatzmaße; ohne die Abschaltung
  // meckert jeder Build.
  adjustFontFallback: false,
});

const flieSStext = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--f-text-noir",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Detective Wimpy",
  description:
    "Schlüpfe in die Rolle von Detective Wimpy, dem Bushbaby, und löse jeden Fall in der Tierstadt.",
  manifest: "/manifest.webmanifest",
  applicationName: "Detective Wimpy",
  appleWebApp: {
    capable: true,
    title: "Detective Wimpy",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-180.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Randlos bis unter Dynamic Island und Home-Indicator (iPhone 16 Pro).
  viewportFit: "cover",
  themeColor: "#080808",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="de"
      data-theme={STANDARD_DESIGN}
      className={`${anzeige.variable} ${flieSStext.variable}`}
    >
      <head>
        {/* Setzt die Design-Wahl, bevor das erste Bild steht - sonst blitzt
            kurz das falsche Design auf. */}
        <script dangerouslySetInnerHTML={{ __html: DESIGN_SKRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

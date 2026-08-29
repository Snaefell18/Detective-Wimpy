import type { Metadata, Viewport } from "next";
import "./globals.css";

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
  themeColor: "#0d0b14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}

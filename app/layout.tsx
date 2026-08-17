import { SerwistProvider } from "@serwist/turbopack/react";
import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Accountability",
  description: "Der Wochenloop für zwei.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Accountability",
  },
  // `manifest` steht hier ABSICHTLICH nicht.
  //
  // Next fügt daraus ein `<link rel="manifest">` OHNE `crossOrigin` ein, und der
  // Browser nimmt das erste Manifest-Link, das er findet. Hinter Cloudflare
  // Access wird das Manifest dann ohne Cookies geholt, Access antwortet mit
  // einer Weiterleitung auf die Login-Seite, und die App ist nicht
  // installierbar. Der handgeschriebene Link im <head> unten hat das Attribut.
};

export const viewport: Viewport = {
  // `viewportFit: cover` plus die Safe-Area-Paddings im Shell: sonst liegt der
  // Weiter-Knopf auf dem iPhone unter der Home-Leiste.
  viewportFit: "cover",
  // Dieselben Werte wie `--bg` in `globals.css`: systemGroupedBackground hell,
  // echtes Schwarz dunkel. Ein abweichender Wert erzeugt auf dem iPhone einen
  // sichtbaren Streifen zwischen Statusleiste und Seite.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <head>
        {/*
         * `crossOrigin="use-credentials"` ist der Unterschied zwischen
         * installierbar und nicht installierbar. Ohne das Attribut holt der
         * Browser das Manifest ohne Cookies; hinter Cloudflare Access ist die
         * Antwort dann eine Weiterleitung auf die Login-Seite, kein Manifest.
         */}
        <link
          rel="manifest"
          href="/manifest.webmanifest"
          crossOrigin="use-credentials"
        />
        {/* iOS liest kein Manifest-Icon für den Homescreen, sondern nur dieses
            Link-Element. Ohne die Zeile bleibt `public/apple-icon.png` unbenutzt
            und iOS legt einen Screenshot der Seite auf den Homescreen. */}
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body>
        {/*
         * Registriert den Service Worker. Ohne diesen Provider wird
         * `/serwist/sw.js` gebaut und ausgeliefert, aber niemals registriert —
         * die Datei lag im Deploy vollständig ungenutzt herum, und die App war
         * dadurch weder installierbar noch offline-fähig.
         *
         * `cacheOnNavigation` füllt den Laufzeit-Cache beim Navigieren, damit
         * offline nicht nur die Startseite da ist.
         */}
        <SerwistProvider swUrl="/serwist/sw.js" cacheOnNavigation>
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}

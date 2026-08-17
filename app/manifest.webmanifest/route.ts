/**
 * Absichtlich eine Route und nicht die `app/manifest.ts`-Konvention.
 *
 * Die Konvention lässt Next ein eigenes `<link rel="manifest">` OHNE
 * `crossOrigin` einfügen, und der Browser nimmt das erste, das er findet — das
 * handgeschriebene aus `layout.tsx` würde also ignoriert und das Manifest ohne
 * Cookies geladen. Hinter Cloudflare Access antwortet der Server darauf mit
 * einer Weiterleitung auf die Login-Seite, und die App ist nicht
 * installierbar. Diese Datei liefert dasselbe JSON unter derselben URL, nur
 * ohne den automatischen Link.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      name: "Accountability",
      short_name: "Accountability",
      description: "Der Wochenloop für zwei.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      // Beides `--bg` aus globals.css im Hellmodus, identisch zum hellen
      // `themeColor` in layout.tsx. Ein Manifest kann nur EINEN Wert tragen —
      // keine prefers-color-scheme-Abfrage —, also gewinnt hell. Weicht der
      // Wert von `--bg` ab, blitzt beim Start der installierten App der falsche
      // Hintergrund auf, bevor die Seite gezeichnet ist.
      background_color: "#f2f2f7",
      theme_color: "#f2f2f7",
      lang: "de",
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    { headers: { "content-type": "application/manifest+json" } },
  );
}

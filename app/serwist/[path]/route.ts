import { createSerwistRoute } from "@serwist/turbopack";

// Serwist baut den Service Worker über diese Route und nicht als eigenen
// Bundler-Durchlauf — das ist, was ihn unter Turbopack funktionieren lässt.
// Die ganze Konfiguration re-exportieren, nicht nur GET: der Helfer setzt auch
// `dynamic`, `revalidate` und `generateStaticParams`, und Next prüft die Route
// gegen alle davon.
export const {
  dynamic,
  dynamicParams,
  revalidate,
  generateStaticParams,
  GET,
} = createSerwistRoute({
  swSrc: "app/sw.ts",
  // `globDirectory` bleibt der Standard (das Projektwurzelverzeichnis). LifeOS
  // setzt hier `.next`, und das ist ein stiller Fehler, den wir nicht
  // übernehmen: die Standard-Glob-Muster lauten `.next/static/**` und
  // `public/**` und sind relativ zu `globDirectory`. Mit `globDirectory:
  // ".next"` wird also nach `.next/.next/static` gesucht, was es nicht gibt —
  // der Precache-Manifest war leer, und eine PWA ohne Precache hat offline
  // nichts als das, was zufällig noch im Runtime-Cache liegt. Messbar am
  // Build-Log: „N precache entries" erscheint nur, wenn N > 0.
  //
  // Die Offline-Seite ist eine gerenderte Route und liegt deshalb in keinem
  // Glob-Muster; ohne diesen Eintrag findet der Fallback in `app/sw.ts` nichts
  // und `app/offline/page.tsx` wäre Dekoration. `revision` ist die Bau-Zeit:
  // sie wird beim Prerender in sw.js eingebacken, ändert sich also genau
  // einmal pro Build und holt die Seite nach jedem Deploy neu.
  additionalPrecacheEntries: [
    { url: "/offline", revision: `build-${Date.now()}` },
  ],
  // Nativ statt wasm. Der Standard ist esbuild-wasm, und ohne dieses Paket
  // bricht `next build` genau hier mit ERR_MODULE_NOT_FOUND ab, während Next
  // die statischen Params dieser Route sammelt. Nativ ist die günstigere
  // Antwort: esbuild liegt über vitest schon im Baum, inklusive
  // @esbuild/linux-arm64 im Lockfile — also auch im Image auf dem Pi — ist
  // schneller und spart die ~10 MB des wasm-Pakets.
  //
  // Der Service Worker wird nur zur Bauzeit gebaut: `dynamic` ist force-static
  // und `generateStaticParams` rendert /serwist/sw.js vor. Im Laufzeit-Image
  // (output: "standalone") braucht esbuild deshalb niemand.
  useNativeEsbuild: true,
});

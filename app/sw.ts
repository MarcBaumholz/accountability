/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

/**
 * Verhindert, dass eine Weiterleitung in den Cache wandert.
 *
 * Der konkrete Fall: vor der App sitzt Cloudflare Access. Läuft die
 * Access-Sitzung ab (Standard 24 h), antwortet Cloudflare auf jede Navigation
 * mit 302 auf die Login-Seite. Der Service Worker folgt der Weiterleitung,
 * bekommt am Ende ein HTTP 200 zurück — nur eben die Login-Seite — und Serwist
 * prüft standardmäßig nur den Status. Damit läge die Login-Seite unter der URL
 * der App im Cache, und die installierte App zeigte dauerhaft eine
 * Login-Seite, auch nach erneutem Anmelden.
 *
 * Das ist in LifeOS wirklich passiert. `response.redirected` ist der
 * verlässliche Marker: bei einer echten Antwort unserer eigenen Herkunft ist er
 * false.
 */
const noRedirects = {
  cacheWillUpdate: async ({ response }: { response: Response }) =>
    response.redirected || response.type === "opaqueredirect" ? null : response,
};

// Die Einträge in defaultCache sind fertig konstruierte Handler; ihre
// plugins-Liste ist zur Laufzeit erweiterbar. Bewusst defensiv: die Form von
// defaultCache gehört Serwist und kann sich zwischen Versionen ändern — dann
// fehlt hier höchstens der Schutz, es bricht nichts.
for (const entry of defaultCache) {
  const plugins = (entry.handler as { plugins?: unknown[] }).plugins;
  if (Array.isArray(plugins)) plugins.push(noRedirects);
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  // Bewusst aus. Navigation Preload startet für jede Navigation eine parallele
  // Netzanfrage; ohne Netz ist dieses Rennen toter Ballast und ein bekannter
  // Weg, genau die Offline-Navigation zu brechen, die es beschleunigen sollte.
  navigationPreload: false,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

import { AuthError, requirePerson } from "@/lib/auth.ts";
import { weeklyReviewCalendar } from "@/lib/ics.ts";

/**
 * Die Kalenderdatei für den festen Wochentermin (PRD 07, Teil B, Stufe 1).
 *
 * Bewusst ein Download und kein Abo-Endpunkt: Stufe 1 ist "beide importieren
 * sie einmal". Ein Abo (webcal) würde von einem Server abgerufen, der keinen
 * Cloudflare-Access-Cookie hat — die Route müsste dafür öffentlich sein. Sie
 * hängt stattdessen an derselben Identitätsprüfung wie alles andere, und die
 * Datei ist ohnehin für beide identisch.
 *
 * Liegt außerhalb der Route-Gruppe `(app)`, hat also nicht deren Layout und
 * damit auch nicht deren Auth-Prüfung. Deshalb steht sie hier ausgeschrieben.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePerson();
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    return new Response("Kein Zugang\n", {
      status: error.status,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(weeklyReviewCalendar(), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="wochenreview.ics"',
      // DTSTAMP ist der Zeitpunkt der Erzeugung und damit bei jedem Abruf neu.
      // Eine gecachte Antwort wäre nicht falsch, aber die Datei wird zweimal im
      // Leben der App abgerufen — Caching hat hier nichts zu gewinnen.
      "cache-control": "no-store",
    },
  });
}

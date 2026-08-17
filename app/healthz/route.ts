import { sqlite } from "@/db/index.ts";

export const dynamic = "force-dynamic";

/**
 * Health-Check für den Container und den Rauchtest nach dem Deploy.
 *
 * Fasst absichtlich die Datenbank an: ein Prozess, der läuft, aber seine
 * eigenen Daten nicht lesen kann, ist nicht gesund — und ihn gesund zu nennen
 * ist genau der Weg, auf dem ein falsch gemountetes Volume einen Deploy
 * unbemerkt übersteht.
 *
 * Ohne Sitzung erreichbar: eine Zeilenzahl verrät nichts. Deshalb steht hier
 * auch `people` und nicht etwa der Inhalt eines Eintrags.
 */
export function GET() {
  try {
    const people = sqlite
      .prepare<[], { c: number }>("SELECT COUNT(*) AS c FROM person")
      .get();

    return Response.json(
      { ok: true, people: people?.c ?? 0 },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      // Eine Konstante, nicht error.message: dieser Endpunkt ist ohne Sitzung
      // erreichbar, und better-sqlite3-Meldungen verraten Pfade im Container.
      { ok: false, reason: "db" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

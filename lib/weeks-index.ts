import "server-only";

import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/db/index.ts";
import { type EntryStatus, statusOf } from "./sharing.ts";
import { prevWeek, weekKey } from "./week.ts";

/**
 * Die Liste der eigenen Wochen (PRD 01: "Eine vergangene Woche bleibt
 * nachträglich füllbar").
 *
 * **Nur die eigenen.** Über den Partner steht hier nichts, auch kein Status und
 * kein Score. Die Freigabe-Stufen aus PRD 02 hängen an einer Woche und an einem
 * Abgabezeitpunkt; eine Übersicht über alle Wochen wäre der bequemste Weg, sie
 * zu umgehen — 26 Zeilen, in denen je eine Stufe stimmen muss, und eine falsche
 * reicht. Wer Partnerinhalte in diese Liste holen will, muss sie pro Zeile durch
 * `partnerVisibility()` schicken; nichts zu zeigen ist die richtige Antwort.
 */

/**
 * Zehn Jahre. Dieselbe Grenze wie `weekSpanAll` im Verlauf: ein
 * Wochenschlüssel, der aus irgendeinem Grund weit in der Vergangenheit liegt,
 * soll keine Liste mit hunderttausend Zeilen erzeugen.
 */
const MAX_WEEKS = 520;

export type WeekRow = {
  week: string;
  status: EntryStatus;
  lifescore: number | null;
  /** Nachträglich angefangen. Zählt für die Daten, nicht für den Streak. */
  late: boolean;
  /** Die laufende Woche. Sie ist nicht verpasst, sie ist offen. */
  current: boolean;
};

/**
 * Alle Wochen von der ersten je gefüllten bis zur laufenden, neueste zuerst.
 *
 * Die Untergrenze ist die erste je gefüllte Woche und nicht "unbegrenzt
 * zurück". Zwei Gründe, und der zweite ist der wichtigere:
 *
 * 1. Eine Liste ohne Untergrenze wächst nach unten ins Leere und hat kein Ende,
 *    das man erreichen kann.
 * 2. Vor der ersten Woche gab es die App für diese Person nicht. Was dort
 *    nachgetragen würde, wäre keine erinnerte Woche, sondern eine erfundene —
 *    und der Verlauf (PRD 04) kann nicht unterscheiden, welche Kurve echt ist.
 *
 * Lücken **innerhalb** des Zeitraums werden ausdrücklich gezeigt: genau das
 * sind die verpassten Wochen, um die es geht.
 */
export async function loadMyWeeks(personId: string): Promise<WeekRow[]> {
  const rows = await db
    .select({
      week: schema.entry.week,
      status: schema.entry.status,
      lifescore: schema.entry.lifescore,
      late: schema.entry.late,
    })
    .from(schema.entry)
    .where(eq(schema.entry.personId, personId))
    .orderBy(asc(schema.entry.week));

  const current = weekKey();
  const byWeek = new Map(rows.map((row) => [row.week, row]));
  // Textsortierung ist chronologisch (der Schlüssel ist zweistellig gepolstert),
  // also ist die erste Zeile die früheste Woche.
  const earliest = rows[0]?.week ?? current;

  const weeks: WeekRow[] = [];
  let cursor = current;
  for (let i = 0; i < MAX_WEEKS; i += 1) {
    const row = byWeek.get(cursor);
    weeks.push({
      week: cursor,
      status: statusOf(row),
      lifescore: row?.lifescore ?? null,
      late: row?.late ?? false,
      current: cursor === current,
    });
    if (cursor <= earliest) break;
    cursor = prevWeek(cursor);
  }

  return weeks;
}

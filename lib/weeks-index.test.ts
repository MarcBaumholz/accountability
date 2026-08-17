import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { migrate } from "../db/migrate.ts";
import * as schema from "../db/schema.ts";
import { prevWeek, weekKey } from "./week.ts";

// `server-only` wirft beim Import außerhalb einer Server-Komponente. Gleiches
// Vorgehen wie in `auth.test.ts`.
vi.mock("server-only", () => ({}));

const sqlite = new Database(":memory:");
migrate(sqlite);
const testDb = drizzle(sqlite, { schema });

vi.mock("@/db/index.ts", () => ({ db: testDb, schema, sqlite }));

const { loadMyWeeks } = await import("./weeks-index.ts");

const ME = "person-me";
const OTHER = "person-other";
const now = Math.floor(Date.now() / 1000);

/**
 * Die Wochen werden relativ zur echten laufenden Woche eingesetzt, nicht auf
 * einen festen Schlüssel. `loadMyWeeks` fragt `weekKey()`, und ein Test mit
 * hart eingetippten Wochen wäre nach der nächsten Woche rot, ohne dass sich
 * etwas geändert hätte.
 */
const CURRENT = weekKey();
const weeksBack = (count: number) => {
  let cursor = CURRENT;
  for (let i = 0; i < count; i += 1) cursor = prevWeek(cursor);
  return cursor;
};

function seedEntry(
  personId: string,
  week: string,
  fields: {
    status?: "draft" | "part1" | "submitted";
    lifescore?: number;
    late?: boolean;
  } = {},
) {
  sqlite
    .prepare(
      `INSERT INTO entry (id, person_id, week, mode, status, lifescore, created_at, updated_at, late)
       VALUES (?, ?, ?, 'full', ?, ?, ?, ?, ?)`,
    )
    .run(
      `${personId}-${week}`,
      personId,
      week,
      fields.status ?? "submitted",
      fields.lifescore ?? null,
      now,
      now,
      fields.late ? 1 : 0,
    );
}

beforeEach(() => {
  sqlite.exec("DELETE FROM entry; DELETE FROM person");
  for (const id of [ME, OTHER]) {
    sqlite
      .prepare(
        "INSERT INTO person (id, email, name, partner_id, created_at) VALUES (?, ?, ?, NULL, ?)",
      )
      .run(id, `${id}@example.com`, id, now);
  }
});

describe("loadMyWeeks", () => {
  it("zeigt ohne jeden Eintrag nur die laufende Woche", async () => {
    const weeks = await loadMyWeeks(ME);
    expect(weeks).toEqual([
      {
        week: CURRENT,
        status: "none",
        lifescore: null,
        late: false,
        current: true,
      },
    ]);
  });

  it("reicht bis zur ersten je gefüllten Woche und nicht weiter", async () => {
    seedEntry(ME, weeksBack(4), { lifescore: 6 });
    seedEntry(ME, weeksBack(1), { lifescore: 8 });

    const weeks = await loadMyWeeks(ME);

    // Fünf Zeilen: laufende Woche bis vier Wochen zurück. Die fünfte Woche
    // zurück gab es die App für diese Person noch nicht.
    expect(weeks.map((w) => w.week)).toEqual([
      CURRENT,
      weeksBack(1),
      weeksBack(2),
      weeksBack(3),
      weeksBack(4),
    ]);
  });

  it("zeigt Lücken innerhalb des Zeitraums als leere Wochen", async () => {
    seedEntry(ME, weeksBack(3), { lifescore: 5 });
    seedEntry(ME, weeksBack(1), { lifescore: 7 });

    const weeks = await loadMyWeeks(ME);
    const gap = weeks.find((w) => w.week === weeksBack(2));

    // Genau das sind die verpassten Wochen, um die es geht — sie müssen
    // erreichbar sein, sonst gibt es keinen Weg zum Nachtragen (PRD 01).
    expect(gap).toEqual({
      week: weeksBack(2),
      status: "none",
      lifescore: null,
      late: false,
      current: false,
    });
  });

  it("gibt Status, Lifescore und die Nachtrag-Markierung weiter", async () => {
    seedEntry(ME, weeksBack(2), {
      status: "submitted",
      lifescore: 4,
      late: true,
    });
    seedEntry(ME, weeksBack(1), { status: "part1", lifescore: 9 });
    seedEntry(ME, CURRENT, { status: "draft" });

    const byWeek = new Map(
      (await loadMyWeeks(ME)).map((row) => [row.week, row]),
    );

    expect(byWeek.get(weeksBack(2))).toMatchObject({
      status: "submitted",
      lifescore: 4,
      late: true,
    });
    expect(byWeek.get(weeksBack(1))).toMatchObject({
      status: "part1",
      lifescore: 9,
      late: false,
    });
    expect(byWeek.get(CURRENT)).toMatchObject({
      status: "draft",
      current: true,
    });
  });

  it("sortiert neueste zuerst", async () => {
    seedEntry(ME, weeksBack(3));
    const weeks = await loadMyWeeks(ME);
    expect(weeks[0].week).toBe(CURRENT);
    expect(weeks[weeks.length - 1].week).toBe(weeksBack(3));
  });

  it("nimmt keine Woche des Partners auf", async () => {
    // Die Liste ist die eigene Historie. Nähme sie fremde Wochen auf, wäre sie
    // ein Weg um die Freigabe-Stufen aus PRD 02 herum — hier prüft der Test,
    // dass die Abfrage nach `person_id` filtert und nicht nur die Anzeige.
    seedEntry(OTHER, weeksBack(6), { lifescore: 10 });
    seedEntry(ME, weeksBack(1), { lifescore: 7 });

    const weeks = await loadMyWeeks(ME);

    expect(weeks.map((w) => w.week)).toEqual([CURRENT, weeksBack(1)]);
    expect(weeks.some((w) => w.lifescore === 10)).toBe(false);
  });
});

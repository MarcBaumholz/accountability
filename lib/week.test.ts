import { describe, expect, it } from "vitest";

import {
  mondayOf,
  nextWeek,
  prevWeek,
  recentWeeks,
  streakOf,
  sundayOf,
  weekKey,
  weekLabel,
  weekRangeLabel,
} from "./week.ts";

describe("weekKey", () => {
  it("ordnet einen Zeitpunkt der Berliner Woche zu, nicht der UTC-Woche", () => {
    // Montag, 24.08.2026, 00:30 Berlin = Sonntag 22:30 UTC. Die naive
    // UTC-Rechnung landet in der Vorwoche (W34) — richtig ist W35.
    expect(weekKey(new Date("2026-08-23T22:30:00Z"))).toBe("2026-W35");
  });

  it("hält Sonntag 23:30 Berlin in der laufenden Woche", () => {
    // Der Moment, in dem der Loop tatsächlich gefüllt wird.
    expect(weekKey(new Date("2026-08-23T21:30:00Z"))).toBe("2026-W34");
  });

  it("rechnet über die Sommerzeitgrenze korrekt", () => {
    // Zeitumstellung 2026: 25.10. Sonntag. 00:30 Berlin ist da noch MESZ
    // (UTC+2), am selben Tag später MEZ (UTC+1).
    expect(weekKey(new Date("2026-10-24T22:30:00Z"))).toBe("2026-W43");
    expect(weekKey(new Date("2026-10-25T23:30:00Z"))).toBe("2026-W44");
  });

  it("legt den 1. Januar 2027 in die Woche 53 von 2026", () => {
    // Freitag. Der häufigste Fehler naiver Wochenrechnung.
    expect(weekKey(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53");
  });

  it("legt den 31. Dezember 2024 in die Woche 1 von 2025", () => {
    // Dienstag — die Woche gehört schon zum Folgejahr.
    expect(weekKey(new Date("2024-12-31T12:00:00Z"))).toBe("2025-W01");
  });

  it("padded die Wochennummer, damit Textsortierung chronologisch ist", () => {
    const keys = ["2026-W10", "2026-W09", "2026-W02"].sort();
    expect(keys).toEqual(["2026-W02", "2026-W09", "2026-W10"]);
    expect(weekKey(new Date("2026-01-08T12:00:00Z"))).toBe("2026-W02");
  });
});

describe("mondayOf / sundayOf", () => {
  it("liefert Montag und Sonntag der Woche", () => {
    expect(mondayOf("2026-W34").toISOString().slice(0, 10)).toBe("2026-08-17");
    expect(sundayOf("2026-W34").toISOString().slice(0, 10)).toBe("2026-08-23");
  });

  it("stimmt für Woche 1, die ins Vorjahr reicht", () => {
    // 2025-W01 beginnt am 30.12.2024.
    expect(mondayOf("2025-W01").toISOString().slice(0, 10)).toBe("2024-12-30");
  });

  it("stimmt für die 53. Woche", () => {
    expect(mondayOf("2026-W53").toISOString().slice(0, 10)).toBe("2026-12-28");
  });
});

describe("prevWeek / nextWeek", () => {
  it("geht innerhalb des Jahres eine Woche zurück und vor", () => {
    expect(prevWeek("2026-W34")).toBe("2026-W33");
    expect(nextWeek("2026-W34")).toBe("2026-W35");
  });

  it("überschreitet die Jahresgrenze korrekt", () => {
    // 2026 hat 53 Wochen — der Sprung geht nicht nach 2026-W52.
    expect(nextWeek("2026-W52")).toBe("2026-W53");
    expect(nextWeek("2026-W53")).toBe("2027-W01");
    expect(prevWeek("2027-W01")).toBe("2026-W53");
  });

  it("ist in beide Richtungen umkehrbar", () => {
    let key = "2025-W50";
    for (let i = 0; i < 20; i += 1) key = nextWeek(key);
    for (let i = 0; i < 20; i += 1) key = prevWeek(key);
    expect(key).toBe("2025-W50");
  });
});

describe("recentWeeks", () => {
  it("liefert aufsteigend mit der Zielwoche am Ende", () => {
    expect(recentWeeks(4, "2026-W34")).toEqual([
      "2026-W31",
      "2026-W32",
      "2026-W33",
      "2026-W34",
    ]);
  });

  it("reicht über die Jahresgrenze zurück", () => {
    expect(recentWeeks(3, "2027-W02")).toEqual([
      "2026-W53",
      "2027-W01",
      "2027-W02",
    ]);
  });
});

describe("streakOf", () => {
  it("zählt zusammenhängende abgegebene Wochen", () => {
    const weeks = new Set(["2026-W32", "2026-W33", "2026-W34"]);
    expect(streakOf(weeks, "2026-W34")).toBe(3);
  });

  it("zählt die offene aktuelle Woche nicht als Bruch", () => {
    // W34 läuft noch, W31–W33 sind abgegeben: der Streak ist 3, nicht 0.
    const weeks = new Set(["2026-W31", "2026-W32", "2026-W33"]);
    expect(streakOf(weeks, "2026-W34")).toBe(3);
  });

  it("bricht bei einer Lücke", () => {
    const weeks = new Set(["2026-W30", "2026-W31", "2026-W33"]);
    expect(streakOf(weeks, "2026-W33")).toBe(1);
  });

  it("ist 0 ohne abgegebene Woche", () => {
    expect(streakOf(new Set(), "2026-W34")).toBe(0);
  });

  it("zählt über die Jahresgrenze", () => {
    const weeks = new Set(["2026-W52", "2026-W53", "2027-W01"]);
    expect(streakOf(weeks, "2027-W01")).toBe(3);
  });
});

describe("Labels", () => {
  it("schreibt die Woche wie im Notion-Template", () => {
    expect(weekLabel("2026-W32")).toBe("KW 32");
  });

  it("zeigt den Datumsbereich kompakt", () => {
    expect(weekRangeLabel("2026-W34")).toBe("17.–23. Aug");
  });

  it("nennt beide Monate, wenn die Woche sie überspannt", () => {
    // 2026-W36: 31. Aug – 6. Sep.
    expect(weekRangeLabel("2026-W36")).toBe("31. Aug – 6. Sep");
  });
});

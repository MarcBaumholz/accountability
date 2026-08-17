import { describe, expect, it } from "vitest";

import {
  LIMITS,
  SCREENS,
  type ScreenId,
  lastScreenOfPart1,
  visibleScreens,
} from "./loop.ts";

type Answers = Parameters<typeof visibleScreens>[1];

/** Die Datenlage, in der jeder Schirm sichtbar sein kann. */
const FULL: Answers = {
  prioReviews: [{ result: "done" }],
  hasPartnerPart1: true,
  hasValues: true,
  hasLastWeekPrios: true,
};

const ids = (mode: "minimal" | "full", answers: Answers = FULL): ScreenId[] =>
  visibleScreens(mode, answers).map((s) => s.id);

describe("visibleScreens: Reihenfolge", () => {
  it("stellt den Rückblick vor die Vorausschau", () => {
    // Teil 1 muss vollständig vor Teil 2 liegen, sonst greift das Freigabe-Gate
    // an der falschen Stelle und der Partner sieht Teil 2 mit.
    const parts = visibleScreens("full", FULL).map((s) => s.part);
    const firstTwo = parts.indexOf(2);
    expect(firstTwo).toBeGreaterThan(0);
    expect(parts.slice(firstTwo).every((p) => p === 2)).toBe(true);
  });

  it("fragt die Identität vor den Prios", () => {
    // Aus den Notizen: "identität -> einfacher prios setzen". Die Reihenfolge
    // ist der Zweck der Frage, nicht Kosmetik.
    const order = ids("full");
    expect(order.indexOf("identity")).toBeLessThan(order.indexOf("prios"));
  });

  it("holt die Weglassen-Frage in den ersten Teil", () => {
    // "weglassen -> eher in ersten teil -> nicht ans ende": am Ende ist keine
    // Kraft mehr da.
    const drop = SCREENS.find((s) => s.id === "drop");
    expect(drop?.part).toBe(1);
    const order = ids("full");
    expect(order.indexOf("drop")).toBeLessThan(order.indexOf("identity"));
  });

  it("zeigt den Rückblick auf die Vorwoche als Erstes", () => {
    expect(ids("full")[0]).toBe("recap");
  });

  it("stellt die Partner-Runde ans Ende", () => {
    const order = ids("full");
    expect(order[order.length - 1]).toBe("partner");
  });
});

describe("visibleScreens: die Lücken-Frage", () => {
  it("erscheint, sobald eine Prio nicht erreicht wurde", () => {
    expect(
      ids("full", { ...FULL, prioReviews: [{ result: "missed" }] }),
    ).toContain("gapReason");
    expect(
      ids("full", { ...FULL, prioReviews: [{ result: "partly" }] }),
    ).toContain("gapReason");
  });

  it("bleibt weg, wenn alles erreicht wurde", () => {
    // Eine Woche, in der alles geklappt hat, soll nicht nach einer Ausrede
    // fragen.
    expect(
      ids("full", {
        ...FULL,
        prioReviews: [{ result: "done" }, { result: "done" }],
      }),
    ).not.toContain("gapReason");
  });

  it("bleibt weg, wenn noch nichts bewertet ist", () => {
    expect(ids("full", { ...FULL, prioReviews: [] })).not.toContain(
      "gapReason",
    );
  });

  it("erscheint, wenn nur eine von drei Prios fehlt", () => {
    expect(
      ids("full", {
        ...FULL,
        prioReviews: [
          { result: "done" },
          { result: "done" },
          { result: "missed" },
        ],
      }),
    ).toContain("gapReason");
  });
});

describe("visibleScreens: Datenlage", () => {
  it("lässt Rückblick und Prio-Bewertung weg, wenn es keine Vorwoche gibt", () => {
    // Die allererste Woche. Ohne diese Regel stünden zwei leere Schirme da.
    const order = ids("full", { ...FULL, hasLastWeekPrios: false });
    expect(order).not.toContain("recap");
    expect(order).not.toContain("prioReview");
    // Der Loop bleibt trotzdem vollständig benutzbar.
    expect(order).toContain("lifescore");
    expect(order).toContain("prios");
  });

  it("lässt den Werte-Check weg, wenn kein Fundament steht", () => {
    expect(ids("full", { ...FULL, hasValues: false })).not.toContain("values");
  });

  it("lässt die Partner-Runde weg, solange nichts freigegeben ist", () => {
    // Der wichtigste Fall: der Partner liefert nicht. Der eigene Loop muss
    // vollständig durchlaufbar bleiben und darf nie am anderen hängen.
    const order = ids("full", { ...FULL, hasPartnerPart1: false });
    expect(order).not.toContain("partner");
    expect(order).toContain("prios");
    expect(order.length).toBeGreaterThan(8);
  });

  it("bleibt bei völlig leerer Datenlage benutzbar", () => {
    const order = ids("full", {
      prioReviews: [],
      hasPartnerPart1: false,
      hasValues: false,
      hasLastWeekPrios: false,
    });
    // Übrig bleiben muss mindestens: Scores, Erfolge, Challenges, Weglassen,
    // Identität, Vision, Prios, Anders-diesmal.
    expect(order).toContain("lifescore");
    expect(order).toContain("prios");
    expect(order).not.toContain("gapReason");
    expect(order.length).toBeGreaterThanOrEqual(6);
  });
});

describe("visibleScreens: die Minimum-Version", () => {
  it("ist echt kürzer als die Vollversion", () => {
    expect(ids("minimal").length).toBeLessThan(ids("full").length);
  });

  it("enthält alles, was den Loop tragen muss", () => {
    // Ohne diese sechs ist es kein Wochenloop mehr: Score, Werte, Auswertung
    // der Vorwoche, Erfolge, Identität, neue Prios.
    const order = ids("minimal");
    for (const required of [
      "lifescore",
      "values",
      "prioReview",
      "wins",
      "identity",
      "prios",
    ] satisfies ScreenId[]) {
      expect(order).toContain(required);
    }
  });

  it("lässt die Textlastigen weg", () => {
    const order = ids("minimal");
    for (const skipped of [
      "areas",
      "challenges",
      "drop",
      "vision",
      "aarBetter",
    ] satisfies ScreenId[]) {
      expect(order).not.toContain(skipped);
    }
  });

  it("behält die Partner-Runde", () => {
    // Die Kurzversion ist für Urlaub und Krankheit. Genau dann ist der
    // Austausch das Einzige, was den Streak am Leben hält.
    expect(ids("minimal")).toContain("partner");
  });

  it("fragt auch in der Kurzversion nie nach der Lücke", () => {
    expect(
      ids("minimal", { ...FULL, prioReviews: [{ result: "missed" }] }),
    ).not.toContain("gapReason");
  });

  it("bleibt in jeder Datenlage kürzer oder gleich lang", () => {
    for (const hasValues of [true, false]) {
      for (const hasLastWeekPrios of [true, false]) {
        for (const hasPartnerPart1 of [true, false]) {
          const answers = {
            ...FULL,
            hasValues,
            hasLastWeekPrios,
            hasPartnerPart1,
          };
          expect(ids("minimal", answers).length).toBeLessThanOrEqual(
            ids("full", answers).length,
          );
        }
      }
    }
  });
});

describe("lastScreenOfPart1", () => {
  it("findet den letzten Rückblick-Schirm, an dem das Gate hängt", () => {
    expect(lastScreenOfPart1(visibleScreens("full", FULL))).toBe("drop");
  });

  it("verschiebt sich mit, wenn Schirme wegfallen", () => {
    // In der Kurzversion endet Teil 1 früher. Läge das Gate weiter auf "drop",
    // würde es nie erreicht und der Partner nie freigeschaltet.
    expect(lastScreenOfPart1(visibleScreens("minimal", FULL))).toBe("wins");
  });

  it("liegt immer auf einem Schirm aus Teil 1", () => {
    for (const mode of ["minimal", "full"] as const) {
      const screens = visibleScreens(mode, FULL);
      const gate = lastScreenOfPart1(screens);
      expect(screens.find((s) => s.id === gate)?.part).toBe(1);
    }
  });

  it("ist null, wenn es keinen Teil-1-Schirm gibt", () => {
    expect(lastScreenOfPart1([])).toBe(null);
  });
});

describe("LIMITS", () => {
  it("hält die Prio-Grenze bei drei", () => {
    // Produktentscheidung, nicht Technik: "ich nehme mir zu viel vor" ist eines
    // der genannten Probleme. Dieser Test existiert, damit die Grenze nicht
    // beiläufig "konfigurierbar" wird.
    expect(LIMITS.prios).toBe(3);
  });

  it("hält die Identität auf einem Wort", () => {
    expect(LIMITS.identityChars).toBeLessThanOrEqual(40);
  });

  it("hält drei aktive Werte", () => {
    expect(LIMITS.activeValues).toBe(3);
  });
});

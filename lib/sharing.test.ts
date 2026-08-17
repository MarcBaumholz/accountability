import { describe, expect, it } from "vitest";

import {
  type EntryStatus,
  partnerVisibility,
  statusOf,
} from "./sharing.ts";

const ALL: EntryStatus[] = ["none", "draft", "part1", "submitted"];

describe("partnerVisibility", () => {
  it("zeigt nichts, solange ich meinen Rückblick nicht abgegeben habe", () => {
    // Das ist die Anchoring-Sperre: egal wie weit der Partner ist, vor meiner
    // eigenen Abgabe sehe ich keinen Inhalt.
    for (const theirs of ALL) {
      expect(partnerVisibility("none", theirs)).toBe("status");
      expect(partnerVisibility("draft", theirs)).toBe("status");
    }
  });

  it("zeigt Teil 1, sobald ich Teil 1 abgegeben habe und er mindestens auch", () => {
    expect(partnerVisibility("part1", "part1")).toBe("part1");
    expect(partnerVisibility("part1", "submitted")).toBe("part1");
    expect(partnerVisibility("submitted", "part1")).toBe("part1");
  });

  it("zeigt alles erst, wenn beide komplett abgegeben haben", () => {
    expect(partnerVisibility("submitted", "submitted")).toBe("all");
  });

  it("zeigt kein Teil 2, wenn nur ich fertig bin", () => {
    // Der wichtigste negative Fall: ich bin durch, er ist bei Teil 1 — seine
    // Prios bleiben verborgen.
    expect(partnerVisibility("submitted", "part1")).not.toBe("all");
  });

  it("blockiert meinen Loop nicht, wenn der Partner nichts füllt", () => {
    expect(partnerVisibility("part1", "none")).toBe("status");
    expect(partnerVisibility("submitted", "none")).toBe("status");
    expect(partnerVisibility("submitted", "draft")).toBe("status");
  });

  it("gibt für jede Kombination genau einen definierten Wert", () => {
    // Verhindert, dass eine neue Statusvariante still auf undefined fällt und
    // ein `if (visibility === "all")` dann versehentlich alles freigibt.
    for (const mine of ALL) {
      for (const theirs of ALL) {
        expect(["status", "part1", "all"]).toContain(
          partnerVisibility(mine, theirs),
        );
      }
    }
  });

  it("gibt nie mehr frei als der Partner selbst erreicht hat", () => {
    // Monotonie: "all" setzt beidseitiges submitted voraus, "part1" mindestens
    // part1 beim Partner. Fängt eine versehentliche Lockerung der Regel.
    for (const mine of ALL) {
      for (const theirs of ALL) {
        const v = partnerVisibility(mine, theirs);
        if (v === "all") {
          expect(mine).toBe("submitted");
          expect(theirs).toBe("submitted");
        }
        if (v === "part1") {
          expect(["part1", "submitted"]).toContain(mine);
          expect(["part1", "submitted"]).toContain(theirs);
        }
      }
    }
  });
});

describe("statusOf", () => {
  it("übersetzt einen fehlenden Eintrag zu none", () => {
    expect(statusOf(null)).toBe("none");
    expect(statusOf(undefined)).toBe("none");
  });

  it("übernimmt den Status eines vorhandenen Eintrags", () => {
    expect(statusOf({ status: "draft" })).toBe("draft");
    expect(statusOf({ status: "part1" })).toBe("part1");
    expect(statusOf({ status: "submitted" })).toBe("submitted");
  });
});

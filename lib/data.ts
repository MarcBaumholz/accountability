import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db, schema } from "@/db/index.ts";
import type { Person } from "./auth.ts";
import { type Mode, visibleScreens } from "./loop.ts";
import {
  type EntryStatus,
  type Visibility,
  partnerVisibility,
  statusOf,
} from "./sharing.ts";
import { prevWeek, recentWeeks, streakOf, weekKey } from "./week.ts";

export type Entry = typeof schema.entry.$inferSelect;
export type Item = typeof schema.item.$inferSelect;
export type Value = typeof schema.value.$inferSelect;
export type Goal = typeof schema.goal.$inferSelect;

/** Ein Eintrag mit allem, was an ihm hängt. */
export type FullEntry = Entry & {
  wins: Item[];
  challenges: Item[];
  drops: Item[];
  prios: Item[];
  prioReviews: Array<{ prioId: string; result: "done" | "partly" | "missed" }>;
  valueChecks: Array<{ valueId: string; score: number }>;
};

async function loadEntry(
  personId: string,
  week: string,
): Promise<FullEntry | null> {
  const row = await db.query.entry.findFirst({
    where: and(
      eq(schema.entry.personId, personId),
      eq(schema.entry.week, week),
    ),
    with: {
      items: { orderBy: asc(schema.item.sort) },
      prioReviews: true,
      valueChecks: true,
    },
  });
  if (!row) return null;

  const { items, prioReviews, valueChecks, ...entry } = row;
  return {
    ...entry,
    wins: items.filter((i) => i.kind === "win"),
    challenges: items.filter((i) => i.kind === "challenge"),
    drops: items.filter((i) => i.kind === "drop"),
    prios: items.filter((i) => i.kind === "prio"),
    prioReviews: prioReviews.map((r) => ({
      prioId: r.prioId,
      result: r.result,
    })),
    valueChecks: valueChecks.map((c) => ({
      valueId: c.valueId,
      score: c.score,
    })),
  };
}

export async function activeValues(personId: string): Promise<Value[]> {
  return db.query.value.findMany({
    where: and(
      eq(schema.value.personId, personId),
      eq(schema.value.active, true),
    ),
    orderBy: asc(schema.value.sort),
  });
}

/**
 * Alle Werte inklusive der deaktivierten — für den Verlauf.
 *
 * Ein Werte-Check aus KW 12 zeigt auf einen Wert, der heute vielleicht nicht
 * mehr aktiv ist. Der Verlauf muss ihn trotzdem benennen können, sonst stehen
 * dort namenlose Kurven (PRD 03).
 */
export async function allValues(personId: string): Promise<Value[]> {
  return db.query.value.findMany({
    where: eq(schema.value.personId, personId),
    orderBy: asc(schema.value.sort),
  });
}

export async function goalsOf(personId: string): Promise<Goal[]> {
  return db.query.goal.findMany({
    where: eq(schema.goal.personId, personId),
    orderBy: asc(schema.goal.sort),
  });
}

/** Die Wochen, die für den Streak zählen: abgegeben und nicht nachgetragen. */
async function submittedWeeks(personId: string): Promise<Set<string>> {
  const rows = await db
    .select({ week: schema.entry.week, late: schema.entry.late })
    .from(schema.entry)
    .where(
      and(
        eq(schema.entry.personId, personId),
        eq(schema.entry.status, "submitted"),
      ),
    );
  // Nachträglich gefüllte Wochen zählen für die Daten, nicht für den Streak
  // (PRD 04) — sonst ist der Streak keine Aussage über Gewohnheit mehr.
  return new Set(rows.filter((r) => !r.late).map((r) => r.week));
}

export type HomeData = {
  week: string;
  me: { status: EntryStatus; mode: Mode | null; streak: number };
  partner: { name: string; status: EntryStatus; at: number | null } | null;
  lastWeekPrios: Item[];
  values: Value[];
  goals: Goal[];
  needsFoundation: boolean;
};

export async function loadHome(
  me: Person,
  partner: Person | null,
): Promise<HomeData> {
  const week = weekKey();
  const last = prevWeek(week);

  const [mine, values, goals, streakWeeks] = await Promise.all([
    loadEntry(me.id, week),
    activeValues(me.id),
    goalsOf(me.id),
    submittedWeeks(me.id),
  ]);

  const lastEntry = await loadEntry(me.id, last);
  const partnerEntry = partner ? await loadEntry(partner.id, week) : null;

  return {
    week,
    me: {
      status: statusOf(mine),
      mode: mine?.mode ?? null,
      streak: streakOf(streakWeeks, week),
    },
    partner: partner
      ? {
          name: partner.name,
          status: statusOf(partnerEntry),
          // Nur der Zeitstempel, kein Inhalt — das ist die ganze Peer Pressure.
          at: partnerEntry?.submittedAt ?? partnerEntry?.part1At ?? null,
        }
      : null,
    lastWeekPrios: lastEntry?.prios ?? [],
    values,
    goals,
    needsFoundation: values.length === 0,
  };
}

/**
 * Der sichtbare Teil des Partner-Eintrags.
 *
 * Die Freigabe wird **hier** entschieden, nicht in der Komponente. Was diese
 * Funktion nicht zurückgibt, kann kein UI-Fehler versehentlich anzeigen.
 */
export type PartnerView =
  | { visibility: "status"; name: string; status: EntryStatus }
  | {
      visibility: "part1";
      name: string;
      status: EntryStatus;
      part1: Part1View;
    }
  | {
      visibility: "all";
      name: string;
      status: EntryStatus;
      part1: Part1View;
      part2: Part2View;
      noteToMe: string | null;
    };

export type Part1View = {
  lifescore: number | null;
  satWork: number | null;
  satLeisure: number | null;
  satSelf: number | null;
  gapReason: string | null;
  wins: string[];
  challenges: string[];
  drops: string[];
  valueChecks: Array<{ label: string; score: number }>;
  prioResults: Array<{ text: string; result: "done" | "partly" | "missed" }>;
};

export type Part2View = {
  identity: string | null;
  vision: string | null;
  aarBetter: string | null;
  prios: string[];
};

async function buildPart1(
  partnerId: string,
  entry: FullEntry,
  week: string,
): Promise<Part1View> {
  const values = await allValues(partnerId);
  const valueLabel = new Map(values.map((v) => [v.id, v.label]));

  // Die bewerteten Prios stehen im Eintrag der VORwoche, nicht in diesem.
  const lastEntry = await loadEntry(partnerId, prevWeek(week));
  const prioText = new Map((lastEntry?.prios ?? []).map((p) => [p.id, p.text]));

  return {
    lifescore: entry.lifescore,
    satWork: entry.satWork,
    satLeisure: entry.satLeisure,
    satSelf: entry.satSelf,
    gapReason: entry.gapReason,
    wins: entry.wins.map((i) => i.text),
    challenges: entry.challenges.map((i) => i.text),
    drops: entry.drops.map((i) => i.text),
    valueChecks: entry.valueChecks.flatMap((c) => {
      const label = valueLabel.get(c.valueId);
      return label ? [{ label, score: c.score }] : [];
    }),
    prioResults: entry.prioReviews.flatMap((r) => {
      const text = prioText.get(r.prioId);
      return text ? [{ text, result: r.result }] : [];
    }),
  };
}

export async function loadPartnerView(
  me: Person,
  partner: Person | null,
  week: string,
): Promise<PartnerView | null> {
  if (!partner) return null;

  const [mine, theirs] = await Promise.all([
    loadEntry(me.id, week),
    loadEntry(partner.id, week),
  ]);

  const visibility: Visibility = partnerVisibility(
    statusOf(mine),
    statusOf(theirs),
  );
  const status = statusOf(theirs);

  if (visibility === "status" || !theirs) {
    return { visibility: "status", name: partner.name, status };
  }

  const part1 = await buildPart1(partner.id, theirs, week);

  if (visibility === "part1") {
    return { visibility: "part1", name: partner.name, status, part1 };
  }

  const noteToMe = await db.query.partnerNote.findFirst({
    where: and(
      eq(schema.partnerNote.week, week),
      eq(schema.partnerNote.authorId, partner.id),
      eq(schema.partnerNote.recipientId, me.id),
    ),
  });

  return {
    visibility: "all",
    name: partner.name,
    status,
    part1,
    part2: {
      identity: theirs.identity,
      vision: theirs.vision,
      aarBetter: theirs.aarBetter,
      prios: theirs.prios.map((p) => p.text),
    },
    noteToMe: noteToMe?.text ?? null,
  };
}

export type LoopData = {
  week: string;
  entry: FullEntry;
  values: Value[];
  goals: Goal[];
  lastWeekPrios: Item[];
  partner: PartnerView | null;
  myNote: string | null;
  screens: ReturnType<typeof visibleScreens>;
};

export async function loadLoop(
  me: Person,
  partner: Person | null,
  week: string,
  entry: FullEntry,
): Promise<LoopData> {
  const [values, goals, lastEntry, partnerView] = await Promise.all([
    activeValues(me.id),
    goalsOf(me.id),
    loadEntry(me.id, prevWeek(week)),
    loadPartnerView(me, partner, week),
  ]);

  const myNote = partner
    ? ((
        await db.query.partnerNote.findFirst({
          where: and(
            eq(schema.partnerNote.week, week),
            eq(schema.partnerNote.authorId, me.id),
          ),
        })
      )?.text ?? null)
    : null;

  const lastWeekPrios = lastEntry?.prios ?? [];

  const screens = visibleScreens(entry.mode, {
    prioReviews: entry.prioReviews,
    hasPartnerPart1:
      partnerView !== null && partnerView.visibility !== "status",
    hasValues: values.length > 0,
    hasLastWeekPrios: lastWeekPrios.length > 0,
  });

  return {
    week,
    entry,
    values,
    goals,
    lastWeekPrios,
    partner: partnerView,
    myNote,
    screens,
  };
}

export { loadEntry };

export type HistoryPoint = {
  week: string;
  lifescore: number | null;
  satWork: number | null;
  satLeisure: number | null;
  satSelf: number | null;
  valueScores: Record<string, number>;
  submitted: boolean;
};

export type History = {
  weeks: string[];
  mine: HistoryPoint[];
  partnerLifescores: Array<number | null> | null;
  partnerName: string | null;
  values: Value[];
  prioRate: { done: number; partly: number; missed: number; total: number };
};

/**
 * Wie viele Wochen "alles" bedeutet: von der ersten je gefüllten Woche bis
 * heute. Gedeckelt bei 520 (zehn Jahre), damit ein Tippfehler im Wochenschlüssel
 * nicht ein Diagramm mit hunderttausend Punkten erzeugt.
 */
export async function weekSpanAll(personId: string): Promise<number> {
  const [earliest] = await db
    .select({ week: schema.entry.week })
    .from(schema.entry)
    .where(eq(schema.entry.personId, personId))
    .orderBy(asc(schema.entry.week))
    .limit(1);
  if (!earliest) return 1;

  let count = 1;
  let cursor = weekKey();
  while (cursor > earliest.week && count < 520) {
    cursor = prevWeek(cursor);
    count += 1;
  }
  return count;
}

export async function loadHistory(
  me: Person,
  partner: Person | null,
  span: number,
): Promise<History> {
  const weeks = recentWeeks(span);
  const values = await allValues(me.id);

  const rows = await db.query.entry.findMany({
    where: and(
      eq(schema.entry.personId, me.id),
      inArray(schema.entry.week, weeks),
    ),
    with: { valueChecks: true, prioReviews: true },
  });
  const byWeek = new Map(rows.map((r) => [r.week, r]));

  const mine: HistoryPoint[] = weeks.map((week) => {
    const row = byWeek.get(week);
    return {
      week,
      lifescore: row?.lifescore ?? null,
      satWork: row?.satWork ?? null,
      satLeisure: row?.satLeisure ?? null,
      satSelf: row?.satSelf ?? null,
      valueScores: Object.fromEntries(
        (row?.valueChecks ?? []).map((c) => [c.valueId, c.score]),
      ),
      submitted: row?.status === "submitted",
    };
  });

  // Der Lifescore des Partners erscheint nur für Wochen, in denen BEIDE
  // abgegeben haben — dieselbe Regel wie im Loop, nur über die Zeit. Sonst
  // wäre der Verlauf ein Umweg um die Freigabe-Stufen.
  let partnerLifescores: Array<number | null> | null = null;
  if (partner) {
    const partnerRows = await db
      .select({
        week: schema.entry.week,
        lifescore: schema.entry.lifescore,
        status: schema.entry.status,
      })
      .from(schema.entry)
      .where(
        and(
          eq(schema.entry.personId, partner.id),
          inArray(schema.entry.week, weeks),
        ),
      );
    const partnerByWeek = new Map(partnerRows.map((r) => [r.week, r]));
    partnerLifescores = weeks.map((week, i) => {
      const theirs = partnerByWeek.get(week);
      if (!theirs || theirs.status !== "submitted") return null;
      if (!mine[i].submitted) return null;
      return theirs.lifescore;
    });
  }

  const allReviews = rows.flatMap((r) => r.prioReviews);
  const prioRate = {
    done: allReviews.filter((r) => r.result === "done").length,
    partly: allReviews.filter((r) => r.result === "partly").length,
    missed: allReviews.filter((r) => r.result === "missed").length,
    total: allReviews.length,
  };

  return {
    weeks,
    mine,
    partnerLifescores,
    partnerName: partner?.name ?? null,
    values,
    prioRate,
  };
}

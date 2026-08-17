"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, schema } from "@/db/index.ts";
import { requirePerson } from "./auth.ts";
import { LIMITS, type Mode } from "./loop.ts";
import { weekKey } from "./week.ts";

const now = () => Math.floor(Date.now() / 1000);

function clampText(value: string, max: number): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, max);
}

function clampScore(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) throw new Error("Kein Zahlenwert");
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Holt den Eintrag der Woche oder legt ihn an.
 *
 * `late` wird beim Anlegen bestimmt und danach nie geändert: eine Woche, die
 * nachträglich gefüllt wird, bleibt für immer nachträglich. Würde das Flag beim
 * Speichern neu berechnet, würde jede Bearbeitung einer alten Woche den Streak
 * anders bewerten (PRD 04).
 */
async function ensureEntry(personId: string, week: string, mode?: Mode) {
  const existing = await db.query.entry.findFirst({
    where: and(
      eq(schema.entry.personId, personId),
      eq(schema.entry.week, week),
    ),
  });
  if (existing) {
    if (mode && mode !== existing.mode) {
      // Der Wechsel löscht nichts. Bereits gegebene Antworten werden in der
      // Minimum-Version nur nicht mehr abgefragt (PRD 01).
      await db
        .update(schema.entry)
        .set({ mode, updatedAt: now() })
        .where(eq(schema.entry.id, existing.id));
      return { ...existing, mode };
    }
    return existing;
  }

  const [created] = await db
    .insert(schema.entry)
    .values({
      id: randomUUID(),
      personId,
      week,
      mode: mode ?? "full",
      status: "draft",
      createdAt: now(),
      updatedAt: now(),
      late: week !== weekKey(),
    })
    .returning();
  return created;
}

export async function startLoop(mode: Mode, week?: string) {
  const { me } = await requirePerson();
  const target = week ?? weekKey();
  await ensureEntry(me.id, target, mode);
  revalidatePath("/");
  revalidatePath(`/loop/${target}`);
}

/**
 * Die skalaren Felder, die per Autosave geschrieben werden dürfen.
 *
 * Eine Allowlist und keine dynamische Spalte: ohne sie wäre `saveField` ein
 * Schreibzugriff auf jede Spalte des Eintrags, `status` und `late` inklusive —
 * also ein Weg, die Freigabe-Stufen zu umgehen.
 */
const SCORE_FIELDS = {
  lifescore: [1, 10],
  satWork: [1, 10],
  satLeisure: [1, 10],
  satSelf: [1, 10],
} as const;

const TEXT_FIELDS = {
  gapReason: LIMITS.textChars,
  vision: LIMITS.textChars,
  aarBetter: LIMITS.textChars,
  identity: LIMITS.identityChars,
} as const;

export async function saveScore(
  week: string,
  field: keyof typeof SCORE_FIELDS,
  value: number | null,
) {
  const { me } = await requirePerson();
  const range = SCORE_FIELDS[field];
  if (!range) throw new Error(`Unbekanntes Feld: ${field}`);

  const entry = await ensureEntry(me.id, week);
  await db
    .update(schema.entry)
    .set({
      [field]: value === null ? null : clampScore(value, range[0], range[1]),
      updatedAt: now(),
    })
    .where(eq(schema.entry.id, entry.id));
}

export async function saveText(
  week: string,
  field: keyof typeof TEXT_FIELDS,
  value: string,
) {
  const { me } = await requirePerson();
  const max = TEXT_FIELDS[field];
  if (!max) throw new Error(`Unbekanntes Feld: ${field}`);

  const entry = await ensureEntry(me.id, week);
  await db
    .update(schema.entry)
    .set({ [field]: clampText(value, max), updatedAt: now() })
    .where(eq(schema.entry.id, entry.id));
}

/**
 * Ersetzt eine Liste vollständig.
 *
 * Löschen-und-neu-schreiben statt Differenzbildung: die Listen sind höchstens
 * eine Handvoll Zeilen, und ein Diff bräuchte stabile IDs im Client, um genau
 * dasselbe Ergebnis zu erreichen. Prios sind die Ausnahme — siehe unten.
 */
export async function saveList(
  week: string,
  kind: "win" | "challenge" | "drop",
  texts: string[],
) {
  const { me } = await requirePerson();
  const entry = await ensureEntry(me.id, week);

  const clean = texts
    .map((t) => clampText(t, LIMITS.itemChars))
    .filter((t): t is string => t !== null);

  // Synchroner Callback, `.run()` statt `await`: better-sqlite3 ist eine
  // synchrone Bibliothek, und drizzle lehnt hier ein Promise ab
  // ("Transaction function cannot return a promise"). Ein async-Callback
  // sieht richtig aus und wirft erst zur Laufzeit.
  db.transaction((tx) => {
    tx.delete(schema.item)
      .where(and(eq(schema.item.entryId, entry.id), eq(schema.item.kind, kind)))
      .run();
    if (clean.length > 0) {
      tx.insert(schema.item)
        .values(
          clean.map((text, sort) => ({
            id: randomUUID(),
            entryId: entry.id,
            kind,
            text,
            sort,
          })),
        )
        .run();
    }
    tx.update(schema.entry)
      .set({ updatedAt: now() })
      .where(eq(schema.entry.id, entry.id))
      .run();
  });
}

/**
 * Prios speichern — mit stabilen IDs, anders als die übrigen Listen.
 *
 * Der Grund: die Prio-Bewertung der Folgewoche zeigt per Fremdschlüssel auf die
 * einzelne Prio. Würde hier gelöscht und neu eingefügt, verlöre eine bereits
 * abgegebene Bewertung ihr Ziel — und weil der Fremdschlüssel `ON DELETE
 * CASCADE` hat, würde sie stillschweigend mitgelöscht. Deshalb: vorhandene
 * Zeilen aktualisieren, nur überzählige entfernen.
 */
export async function savePrios(week: string, texts: string[]) {
  const { me } = await requirePerson();
  const entry = await ensureEntry(me.id, week);

  const clean = texts
    .map((t) => clampText(t, LIMITS.itemChars))
    .filter((t): t is string => t !== null)
    // Harte Produktgrenze: "ich nehme mir zu viel vor" ist eines der
    // genannten Probleme. Die Grenze wird serverseitig durchgesetzt, nicht nur
    // durch drei Eingabefelder im UI.
    .slice(0, LIMITS.prios);

  const existing = await db.query.item.findMany({
    where: and(eq(schema.item.entryId, entry.id), eq(schema.item.kind, "prio")),
    orderBy: schema.item.sort,
  });

  db.transaction((tx) => {
    for (const [sort, text] of clean.entries()) {
      const row = existing[sort];
      if (row) {
        tx.update(schema.item)
          .set({ text, sort })
          .where(eq(schema.item.id, row.id))
          .run();
      } else {
        tx.insert(schema.item)
          .values({
            id: randomUUID(),
            entryId: entry.id,
            kind: "prio",
            text,
            sort,
          })
          .run();
      }
    }
    const surplus = existing.slice(clean.length).map((r) => r.id);
    if (surplus.length > 0) {
      tx.delete(schema.item).where(inArray(schema.item.id, surplus)).run();
    }
    tx.update(schema.entry)
      .set({ updatedAt: now() })
      .where(eq(schema.entry.id, entry.id))
      .run();
  });
}

export async function savePrioReview(
  week: string,
  prioId: string,
  result: "done" | "partly" | "missed",
) {
  const { me } = await requirePerson();
  const entry = await ensureEntry(me.id, week);

  // Die Prio muss zu einem Eintrag DIESER Person gehören. Ohne die Prüfung
  // könnte eine erratene ID eine Bewertung an eine Prio des Partners hängen.
  const prio = await db.query.item.findFirst({
    where: eq(schema.item.id, prioId),
    with: { entry: true },
  });
  if (!prio || prio.entry.personId !== me.id) {
    throw new Error("Unbekannte Prio");
  }

  await db
    .insert(schema.prioReview)
    .values({ id: randomUUID(), entryId: entry.id, prioId, result })
    .onConflictDoUpdate({
      target: [schema.prioReview.entryId, schema.prioReview.prioId],
      set: { result },
    });
  await db
    .update(schema.entry)
    .set({ updatedAt: now() })
    .where(eq(schema.entry.id, entry.id));
}

export async function saveValueCheck(
  week: string,
  valueId: string,
  score: number,
) {
  const { me } = await requirePerson();
  const entry = await ensureEntry(me.id, week);

  const value = await db.query.value.findFirst({
    where: and(
      eq(schema.value.id, valueId),
      eq(schema.value.personId, me.id),
    ),
  });
  if (!value) throw new Error("Unbekannter Wert");

  await db
    .insert(schema.valueCheck)
    .values({
      id: randomUUID(),
      entryId: entry.id,
      valueId,
      score: clampScore(score, 1, 5),
    })
    .onConflictDoUpdate({
      target: [schema.valueCheck.entryId, schema.valueCheck.valueId],
      set: { score: clampScore(score, 1, 5) },
    });
  await db
    .update(schema.entry)
    .set({ updatedAt: now() })
    .where(eq(schema.entry.id, entry.id));
}

/**
 * Gibt Teil 1 frei. Der Übergang ist nicht zurücknehmbar — er macht etwas für
 * den Partner sichtbar, und "hab ich doch nicht gemeint" gibt es dafür nicht.
 *
 * Die Antworten selbst bleiben danach editierbar: Tippfehler zu korrigieren
 * muss möglich sein. Was der Partner sieht, ändert sich mit.
 */
export async function submitPart1(week: string) {
  const { me } = await requirePerson();
  const entry = await ensureEntry(me.id, week);
  if (entry.status !== "draft") return;

  await db
    .update(schema.entry)
    .set({ status: "part1", part1At: now(), updatedAt: now() })
    .where(eq(schema.entry.id, entry.id));
  revalidatePath("/");
  revalidatePath(`/loop/${week}`);
}

export async function submitEntry(week: string) {
  const { me } = await requirePerson();
  const entry = await ensureEntry(me.id, week);

  // Mindestens eine Prio ist Pflicht: ohne sie gibt es nächste Woche nichts zu
  // bewerten und der Loop verliert seinen Zweck (PRD 01).
  const prios = await db.query.item.findMany({
    where: and(eq(schema.item.entryId, entry.id), eq(schema.item.kind, "prio")),
  });
  if (prios.length === 0) {
    throw new Error("Mindestens eine Prio für nächste Woche");
  }

  await db
    .update(schema.entry)
    .set({
      status: "submitted",
      submittedAt: now(),
      part1At: entry.part1At ?? now(),
      updatedAt: now(),
    })
    .where(eq(schema.entry.id, entry.id));
  revalidatePath("/");
  revalidatePath("/verlauf");
  revalidatePath(`/loop/${week}`);
}

export async function savePartnerNote(week: string, text: string) {
  const { me, partner } = await requirePerson();
  if (!partner) return;

  const clean = clampText(text, LIMITS.textChars);
  if (clean === null) {
    await db
      .delete(schema.partnerNote)
      .where(
        and(
          eq(schema.partnerNote.week, week),
          eq(schema.partnerNote.authorId, me.id),
        ),
      );
    return;
  }

  await db
    .insert(schema.partnerNote)
    .values({
      id: randomUUID(),
      week,
      authorId: me.id,
      recipientId: partner.id,
      text: clean,
      createdAt: now(),
    })
    .onConflictDoUpdate({
      target: [schema.partnerNote.week, schema.partnerNote.authorId],
      set: { text: clean },
    });
}

/**
 * Das Fundament speichern (PRD 03).
 *
 * Werte werden deaktiviert, nicht gelöscht: alte Wochen behalten den Wert,
 * gegen den sie bewertet wurden. Wer "Gesundheit" gegen "Ruhe" tauscht, hat im
 * Verlauf zwei Kurven, die zu unterschiedlichen Zeiten enden und beginnen —
 * und das ist richtig, nicht ein Fehler.
 */
export async function saveFoundation(
  values: Array<{ id?: string; label: string; description: string }>,
  goals: string[],
) {
  const { me } = await requirePerson();

  const cleanValues = values
    .flatMap((v) => {
      const label = clampText(v.label, LIMITS.valueLabelChars);
      // Ein Wert ohne Namen ist keine Zeile, sondern eine leere Zeile im
      // Formular — sie fällt weg statt einen namenlosen Datensatz anzulegen.
      if (label === null) return [];
      return [
        {
          id: v.id,
          label,
          description: clampText(v.description, LIMITS.valueDescChars),
        },
      ];
    })
    .slice(0, LIMITS.activeValues);

  const cleanGoals = goals
    .map((g) => clampText(g, LIMITS.goalChars))
    .filter((g): g is string => g !== null);

  const existing = await db.query.value.findMany({
    where: eq(schema.value.personId, me.id),
  });
  const keep = new Set(cleanValues.map((v) => v.id).filter(Boolean));

  db.transaction((tx) => {
    for (const [sort, v] of cleanValues.entries()) {
      if (v.id && existing.some((e) => e.id === v.id)) {
        tx.update(schema.value)
          .set({
            label: v.label,
            description: v.description,
            sort,
            active: true,
          })
          .where(eq(schema.value.id, v.id))
          .run();
      } else {
        tx.insert(schema.value)
          .values({
            id: randomUUID(),
            personId: me.id,
            label: v.label,
            description: v.description,
            sort,
            active: true,
            createdAt: now(),
          })
          .run();
      }
    }

    // Deaktivieren, nicht löschen.
    const drop = existing.filter((e) => e.active && !keep.has(e.id));
    for (const e of drop) {
      tx.update(schema.value)
        .set({ active: false })
        .where(eq(schema.value.id, e.id))
        .run();
    }

    tx.delete(schema.goal).where(eq(schema.goal.personId, me.id)).run();
    if (cleanGoals.length > 0) {
      tx.insert(schema.goal)
        .values(
          cleanGoals.map((label, sort) => ({
            id: randomUUID(),
            personId: me.id,
            label,
            sort,
            createdAt: now(),
          })),
        )
        .run();
    }
  });

  revalidatePath("/");
  revalidatePath("/fundament");
}

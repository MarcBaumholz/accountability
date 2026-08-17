import { relations } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

/**
 * Zwei Nutzer, fest verdrahtet (PRD 08). Die Identität kommt aus dem
 * Cloudflare-Access-Header; diese Tabelle hält nur Name und Partnerbezug.
 *
 * `partnerId` ist absichtlich eine Spalte und keine berechnete "der andere":
 * sobald ein dritter Datensatz existiert, wäre "der andere" nicht mehr
 * eindeutig, und der Fehler wäre still.
 */
export const person = sqliteTable("person", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  partnerId: text("partner_id"),
  createdAt: integer("created_at").notNull(),
});

/**
 * Das Fundament (PRD 03). Genau drei aktive Werte pro Person.
 *
 * Werte werden deaktiviert, nicht gelöscht: ein Werte-Check aus KW 12 zeigt auf
 * diesen Datensatz, und wer den Wert löscht, löscht rückwirkend die Bedeutung
 * seiner alten Antworten.
 */
export const value = sqliteTable(
  "value",
  {
    id: text("id").primaryKey(),
    personId: text("person_id")
      .notNull()
      .references(() => person.id),
    label: text("label").notNull(),
    description: text("description"),
    sort: integer("sort").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("value_person_idx").on(t.personId, t.active)],
);

/** Jahresziele. In Welle 1 nur Anzeige — die Verknüpfung zu Prios ist Welle 2. */
export const goal = sqliteTable(
  "goal",
  {
    id: text("id").primaryKey(),
    personId: text("person_id")
      .notNull()
      .references(() => person.id),
    label: text("label").notNull(),
    sort: integer("sort").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("goal_person_idx").on(t.personId)],
);

/**
 * Ein Eintrag ist eine Person in einer Woche. `week` ist der ISO-Schlüssel
 * ("2026-W34"), damit die Sortierung als Text der chronologischen entspricht.
 *
 * Der `status` ist die Freigabe-Stufe aus PRD 02 und steuert, was der Partner
 * sehen darf. Er wird serverseitig geprüft, nicht nur im UI ausgeblendet.
 */
export const entry = sqliteTable(
  "entry",
  {
    id: text("id").primaryKey(),
    personId: text("person_id")
      .notNull()
      .references(() => person.id),
    week: text("week").notNull(),
    mode: text("mode", { enum: ["minimal", "full"] })
      .notNull()
      .default("full"),
    status: text("status", {
      enum: ["draft", "part1", "submitted"],
    })
      .notNull()
      .default("draft"),

    // Teil 1 — Rückblick, geklickt. Alle nullable: ein unberührter Slider ist
    // keine Antwort und darf nicht als 5 in den Verlauf wandern (PRD 01).
    lifescore: integer("lifescore"),
    satWork: integer("sat_work"),
    satLeisure: integer("sat_leisure"),
    satSelf: integer("sat_self"),
    gapReason: text("gap_reason"),

    // Teil 3 — Vorausschau.
    identity: text("identity"),
    vision: text("vision"),
    aarBetter: text("aar_better"),

    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    part1At: integer("part1_at"),
    submittedAt: integer("submitted_at"),
    // Getrennt von submittedAt: eine nachträglich gefüllte Woche zählt für die
    // Daten, aber nicht für den Streak (PRD 04). Ohne dieses Feld wäre das
    // nicht unterscheidbar.
    late: integer("late", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    unique("entry_person_week").on(t.personId, t.week),
    index("entry_week_idx").on(t.week),
  ],
);

/**
 * Erfolge, Challenges, Weglassen und Prios — alle vier sind Listen und teilen
 * eine Tabelle, weil sie sich nur im `kind` unterscheiden.
 *
 * Prios liegen absichtlich hier und nicht in eigenen Spalten am Eintrag: die
 * Prio-Auswertung der Folgewoche zeigt per Fremdschlüssel auf die einzelne
 * Prio, und dafür braucht sie eine eigene ID.
 */
export const item = sqliteTable(
  "item",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entry.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["win", "challenge", "drop", "prio"],
    }).notNull(),
    text: text("text").notNull(),
    sort: integer("sort").notNull(),
  },
  (t) => [index("item_entry_idx").on(t.entryId, t.kind)],
);

/**
 * Die Bewertung einer Prio aus der Vorwoche (PRD 01, Schirm 4).
 *
 * `prioId` zeigt auf die Prio im Eintrag der Vorwoche. Das ist die
 * After-Action-Review-Verbindung: "was sollte passieren" (die Prio) und "was
 * ist passiert" (dieses Ergebnis) hängen an einem Fremdschlüssel zusammen.
 */
export const prioReview = sqliteTable(
  "prio_review",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entry.id, { onDelete: "cascade" }),
    prioId: text("prio_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    result: text("result", { enum: ["done", "partly", "missed"] }).notNull(),
  },
  (t) => [unique("prio_review_unique").on(t.entryId, t.prioId)],
);

/** Werte-Check: pro Wert ein Slider 1–5 (PRD 03). */
export const valueCheck = sqliteTable(
  "value_check",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entry.id, { onDelete: "cascade" }),
    valueId: text("value_id")
      .notNull()
      .references(() => value.id),
    score: integer("score").notNull(),
  },
  (t) => [unique("value_check_unique").on(t.entryId, t.valueId)],
);

/**
 * Die Empfehlung an den Partner (PRD 02, Schirm 14).
 *
 * Hängt an der Woche und nicht am Eintrag des Empfängers: sie entsteht, während
 * der Empfänger vielleicht noch gar keinen Eintrag hat.
 */
export const partnerNote = sqliteTable(
  "partner_note",
  {
    id: text("id").primaryKey(),
    week: text("week").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => person.id),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => person.id),
    text: text("text").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [unique("partner_note_unique").on(t.week, t.authorId)],
);

export const personRelations = relations(person, ({ many }) => ({
  values: many(value),
  goals: many(goal),
  entries: many(entry),
}));

export const entryRelations = relations(entry, ({ one, many }) => ({
  person: one(person, {
    fields: [entry.personId],
    references: [person.id],
  }),
  items: many(item),
  prioReviews: many(prioReview),
  valueChecks: many(valueCheck),
}));

export const itemRelations = relations(item, ({ one }) => ({
  entry: one(entry, { fields: [item.entryId], references: [entry.id] }),
}));

export const prioReviewRelations = relations(prioReview, ({ one }) => ({
  entry: one(entry, { fields: [prioReview.entryId], references: [entry.id] }),
  prio: one(item, { fields: [prioReview.prioId], references: [item.id] }),
}));

export const valueCheckRelations = relations(valueCheck, ({ one }) => ({
  entry: one(entry, { fields: [valueCheck.entryId], references: [entry.id] }),
  value: one(value, { fields: [valueCheck.valueId], references: [value.id] }),
}));

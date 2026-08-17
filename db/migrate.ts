import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";

/**
 * Wendet die SQL-Migrationen an, wenn die Datenbank geöffnet wird — nicht als
 * eigener Deploy-Schritt.
 *
 * Der Grund ist konkret und in LifeOS teuer gelernt: die Standalone-Ausgabe von
 * Next enthält nur die Pakete, die der getracte Server-Bundle braucht.
 * `drizzle-orm` ist nicht darunter, weil es in die Server-Chunks
 * hineinkompiliert wird. Ein `node db/migrate.ts` im Runner-Image stirbt
 * deshalb mit ERR_MODULE_NOT_FOUND. Alles hier benutzt nur `node:fs` und den
 * rohen better-sqlite3-Handle und funktioniert damit auch dort.
 */
export function migrate(sqlite: Database.Database): { migrated: number } {
  // `next build` wertet Module aus, um Seitendaten zu sammeln, und tut das mit
  // mehreren Worker-Prozessen. Migrieren ist dort sinnlos (der Build-Container
  // hat kein Datenvolume) und schädlich: zwei Worker liefen in LifeOS ins
  // Rennen, der zweite starb mit "table already exists" und riss den Build mit.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return { migrated: 0 };
  }

  const dir = join(process.cwd(), "db", "migrations");

  let files: string[] = [];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    return { migrated: 0 };
  }

  let migrated = 0;

  // BEGIN EXCLUSIVE über den ganzen Lauf, und die Menge der angewendeten
  // Migrationen wird INNERHALB des Locks gelesen. Zwei gleichzeitig startende
  // Prozesse können daher nicht beide entscheiden, dass eine Migration offen
  // ist — der Verlierer wartet und sieht sie dann als erledigt.
  const run = sqlite.transaction(() => {
    sqlite.exec(
      `CREATE TABLE IF NOT EXISTS _migrations (
         name TEXT PRIMARY KEY,
         applied_at INTEGER NOT NULL
       )`,
    );

    const done = new Set(
      sqlite
        .prepare<[], { name: string }>("SELECT name FROM _migrations")
        .all()
        .map((r) => r.name),
    );

    for (const file of files) {
      if (done.has(file)) continue;
      const sqlText = readFileSync(join(dir, file), "utf8");
      const statements = sqlText
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);

      for (const statement of statements) sqlite.exec(statement);
      sqlite
        .prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)")
        .run(file, Math.floor(Date.now() / 1000));
      migrated += 1;
    }
  });
  run.exclusive();

  return { migrated };
}

/**
 * Legt die zwei Personen an und verknüpft sie als Partner.
 *
 * Die Adressen kommen aus `ACC_PEOPLE` und stehen absichtlich nicht im Code:
 * das Repo soll keine privaten E-Mail-Adressen enthalten, und einen Partner
 * hinzuzunehmen darf kein Code-Deploy sein.
 *
 *     ACC_PEOPLE="marc@example.com:Marc,chris@example.com:Chris"
 *
 * Idempotent. Bestehende Personen werden nicht überschrieben, nur fehlende
 * angelegt und die Partnerverknüpfung nachgezogen.
 */
export function bootstrapPeople(sqlite: Database.Database): void {
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const raw = process.env.ACC_PEOPLE?.trim();
  if (!raw) return;

  const people = raw
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [email, name] = chunk.split(":").map((s) => s?.trim());
      if (!email || !name) {
        throw new Error(
          `ACC_PEOPLE fehlerhaft bei "${chunk}" — erwartet "email:Name"`,
        );
      }
      return { email: email.toLowerCase(), name };
    });

  if (people.length !== 2) {
    throw new Error(
      `ACC_PEOPLE muss genau zwei Personen enthalten, gefunden: ${people.length}`,
    );
  }

  // Zwei EINTRÄGE sind nicht zwei PERSONEN. Steht dieselbe Adresse zweimal
  // drin, verknüpfte die Schleife unten die Person mit sich selbst — und wer
  // sein eigener Partner ist, sieht die eigenen Antworten als die des Partners.
  // Damit wäre die Anchoring-Sperre aus PRD 02 wirkungslos, und zwar lautlos.
  // `lib/auth.ts` fängt den Fall inzwischen ab; hier gehört er zurückgewiesen,
  // weil eine Fehlkonfiguration nicht bis in die Laufzeit tragen soll.
  if (people[0].email === people[1].email) {
    throw new Error(
      `ACC_PEOPLE enthält "${people[0].email}" zweimal — es braucht zwei verschiedene Adressen`,
    );
  }

  const now = Math.floor(Date.now() / 1000);

  sqlite.transaction(() => {
    const insert = sqlite.prepare(
      `INSERT INTO person (id, email, name, partner_id, created_at)
       VALUES (?, ?, ?, NULL, ?)
       ON CONFLICT(email) DO UPDATE SET name = excluded.name`,
    );
    for (const p of people) {
      // Die ID wird aus der E-Mail abgeleitet und ist damit über Neuanlagen
      // stabil — ein zufälliges UUID würde bei einem verlorenen Volume neue
      // IDs erzeugen und alte Einträge verwaisen lassen.
      insert.run(idForEmail(p.email), p.email, p.name, now);
    }

    // Partnerverknüpfung in beide Richtungen, immer neu gesetzt: so heilt ein
    // Wechsel des Partners (andere Adresse in ACC_PEOPLE) sich selbst.
    const [a, b] = people.map((p) => idForEmail(p.email));
    const link = sqlite.prepare(
      "UPDATE person SET partner_id = ? WHERE id = ?",
    );
    link.run(b, a);
    link.run(a, b);
  })();
}

/** Stabile ID aus der E-Mail: kleingeschrieben, nur `a-z0-9`. */
function idForEmail(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { bootstrapPeople, migrate } from "./migrate.ts";
import * as schema from "./schema.ts";

/**
 * Die Datenbank muss auf einem gemounteten Volume liegen, nie in einer
 * Image-Schicht — sonst löscht jeder Redeploy die Daten.
 */
const DB_PATH = process.env.ACC_DB_PATH ?? "./data/accountability.db";

function open() {
  mkdirSync(/* turbopackIgnore: true */ dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  // Zwei Schreiber auf einer Datei: warten statt SQLITE_BUSY werfen.
  sqlite.pragma("busy_timeout = 5000");
  // FULL, nicht das WAL-Standard NORMAL. Mit NORMAL kann ein Stromausfall die
  // letzten bestätigten Transaktionen verlieren — die Datei bleibt gültig, die
  // jüngsten Schreibvorgänge sind weg. Das läuft auf einem Raspberry Pi ohne
  // USV, und das Einzige, was hier nicht verloren gehen darf, ist genau das,
  // was jemand gerade geschrieben hat. Kosten: ein fsync pro Commit,
  // bedeutungslos bei zwei Nutzern.
  sqlite.pragma("synchronous = FULL");

  const result = migrate(sqlite);
  bootstrapPeople(sqlite);

  if (result.migrated > 0) {
    console.log(`[accountability] ${result.migrated} Migration(en) angewendet`);
  }

  return { sqlite };
}

// Next dev kompiliert Module bei jeder Änderung neu; ohne globalen Cache würde
// pro Reload ein neuer SQLite-Handle geöffnet und Dateideskriptoren lecken.
const globalForDb = globalThis as unknown as {
  __accountability?: ReturnType<typeof open>;
};

const handle = (globalForDb.__accountability ??= open());

export const sqlite = handle.sqlite;
export const db = drizzle(handle.sqlite, { schema });
export { schema };

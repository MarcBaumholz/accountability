import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bootstrapPeople, migrate } from "../db/migrate.ts";
import * as schema from "../db/schema.ts";

/**
 * `server-only` wirft beim Import außerhalb einer Server-Komponente — das ist
 * sein ganzer Zweck. Hier ein leeres Modul, damit `lib/auth.ts` überhaupt
 * geladen werden kann.
 */
vi.mock("server-only", () => ({}));

/**
 * Echte SQLite im Speicher, echte Migration, echter `bootstrapPeople`.
 *
 * Absichtlich keine handgeschriebene Fake-Datenbank: die interessante Naht ist
 * genau die zwischen `bootstrapPeople` (schreibt kleingeschrieben) und der
 * Abfrage in `requirePerson` (vergleicht exakt). Ein Fake, der selbst
 * `toLowerCase()` vergleicht, würde einen Groß-/Kleinschreibungsfehler
 * verdecken statt ihn zu finden.
 *
 * Die Adresse steht hier bewusst gemischt geschrieben: `bootstrapPeople` muss
 * sie kleinschreiben, sonst findet der Login sie nie.
 */
const sqlite = new Database(":memory:");
migrate(sqlite);
process.env.ACC_PEOPLE = "Marc@Example.com:Marc,chris@example.com:Chris";
bootstrapPeople(sqlite);
const testDb = drizzle(sqlite, { schema });

vi.mock("@/db/index.ts", () => ({ db: testDb, schema, sqlite }));

/**
 * Der Header-Zustand der aktuellen "Anfrage".
 *
 * Zwei Sorten Attrappen, und der Unterschied ist wichtig:
 *
 * - `accessHeaders()` baut ein echtes `Headers`-Objekt. Nur damit sind
 *   Groß-/Kleinschreibung des Header-Namens und das Zusammenfügen mehrerer
 *   Instanzen so getestet, wie Node es tatsächlich macht.
 * - `rawHeader()` liefert den Wert unverändert zurück. Nötig, weil `Headers`
 *   Whitespace um den Wert selbst schon abschneidet — ohne diese Attrappe wäre
 *   der Trim-Test in `lib/auth.ts` gar nicht geprüft, sondern nur der von
 *   undici.
 */
let currentHeaders: { get(name: string): string | null } = new Headers();

vi.mock("next/headers", () => ({ headers: async () => currentHeaders }));

const HEADER = "Cf-Access-Authenticated-User-Email";

function accessHeaders(...values: string[]): Headers {
  const h = new Headers();
  for (const value of values) h.append(HEADER, value);
  return h;
}

function rawHeader(value: string) {
  return {
    get: (name: string) =>
      name.toLowerCase() === HEADER.toLowerCase() ? value : null,
  };
}

// Erst nach dem Setup laden: die Mock-Factory oben greift auf `testDb` zu.
const { AuthError, requirePerson } = await import("./auth.ts");

beforeEach(() => {
  currentHeaders = new Headers();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DEV_USER_EMAIL", undefined);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("requirePerson — der gültige Fall", () => {
  it("erkennt die Person aus dem Access-Header", async () => {
    currentHeaders = accessHeaders("marc@example.com");
    const { me } = await requirePerson();
    expect(me.name).toBe("Marc");
    expect(me.email).toBe("marc@example.com");
  });

  it("löst den Partner in beide Richtungen auf", async () => {
    // Die Verknüpfung ist wechselseitig; einseitig getestet würde ein
    // vergessenes zweites UPDATE in `bootstrapPeople` nicht auffallen.
    currentHeaders = accessHeaders("marc@example.com");
    expect((await requirePerson()).partner?.name).toBe("Chris");

    currentHeaders = accessHeaders("chris@example.com");
    const chris = await requirePerson();
    expect(chris.me.name).toBe("Chris");
    expect(chris.partner?.name).toBe("Marc");
  });

  it("findet den Header unabhängig von seiner Schreibweise", async () => {
    // Cloudflare schickt den Namen gemischt geschrieben, gelesen wird
    // kleingeschrieben. Ein echtes Headers-Objekt beweist, dass das trägt —
    // eine handgeschriebene Attrappe würde nur meine eigene Annahme prüfen.
    currentHeaders = new Headers({
      "CF-ACCESS-AUTHENTICATED-USER-EMAIL": "marc@example.com",
    });
    expect((await requirePerson()).me.name).toBe("Marc");
  });

  it("akzeptiert eine großgeschriebene Adresse", async () => {
    currentHeaders = accessHeaders("MARC@EXAMPLE.COM");
    expect((await requirePerson()).me.name).toBe("Marc");
  });

  it("akzeptiert Whitespace um den Wert", async () => {
    currentHeaders = rawHeader("  marc@example.com\t");
    expect((await requirePerson()).me.name).toBe("Marc");
  });
});

describe("requirePerson — die zweite Tür", () => {
  it("weist eine Adresse ab, die nicht in der Personen-Tabelle steht", async () => {
    // Access könnte sie durchlassen (Policy zu weit, Policy versehentlich
    // leer) — die Tabelle ist die zweite Sperre.
    currentHeaders = accessHeaders("fremd@example.com");
    await expect(requirePerson()).rejects.toBeInstanceOf(AuthError);
  });

  it("gibt die abgewiesene Adresse nicht in der Fehlermeldung zurück", async () => {
    // Die Layouts rendern `error.message` in die Seite. Was im Header stand,
    // darf dort nicht wieder auftauchen.
    currentHeaders = accessHeaders("fremd@example.com");
    const error = await requirePerson().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthError);
    const thrown = error as Error & { status: number };
    expect(thrown.message).not.toContain("fremd@example.com");
    // Die Form von AuthError ist Vertrag für die Layouts: `message` + `status`.
    expect(thrown.status).toBe(403);
  });

  it("protokolliert die abgewiesene Adresse serverseitig", async () => {
    // Der Gegenwert zum Punkt oben: nachvollziehbar bleibt es trotzdem, nur im
    // Container-Log statt in der Antwort.
    currentHeaders = accessHeaders("fremd@example.com");
    await requirePerson().catch(() => {});
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("fremd@example.com"),
    );
  });
});

describe("requirePerson — fehlender Header", () => {
  it("weist in Produktion ab, auch wenn DEV_USER_EMAIL gesetzt ist", async () => {
    // Der wichtigste Test der Datei. Ein fehlender Header darf in Produktion
    // niemals zu einem Ersatznutzer werden.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_USER_EMAIL", "marc@example.com");
    currentHeaders = new Headers();
    await expect(requirePerson()).rejects.toBeInstanceOf(AuthError);
  });

  it("weist bei leerem NODE_ENV ab, auch wenn DEV_USER_EMAIL gesetzt ist", async () => {
    // `node server.js` ohne gesetztes NODE_ENV. Eine Prüfung auf
    // `!== "production"` hätte hier den Ersatznutzer zugelassen.
    vi.stubEnv("NODE_ENV", "");
    vi.stubEnv("DEV_USER_EMAIL", "marc@example.com");
    currentHeaders = new Headers();
    await expect(requirePerson()).rejects.toBeInstanceOf(AuthError);
  });

  it("nimmt lokal DEV_USER_EMAIL", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_USER_EMAIL", "marc@example.com");
    currentHeaders = new Headers();
    expect((await requirePerson()).me.name).toBe("Marc");
  });

  it("weist lokal ohne DEV_USER_EMAIL ab", async () => {
    vi.stubEnv("NODE_ENV", "development");
    currentHeaders = new Headers();
    await expect(requirePerson()).rejects.toBeInstanceOf(AuthError);
  });

  it("weist lokal ein unbrauchbares DEV_USER_EMAIL ab", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_USER_EMAIL", "marc");
    currentHeaders = new Headers();
    await expect(requirePerson()).rejects.toBeInstanceOf(AuthError);
  });

  it("behandelt einen leeren Header wie einen fehlenden", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_USER_EMAIL", "marc@example.com");
    currentHeaders = rawHeader("   ");
    expect((await requirePerson()).me.name).toBe("Marc");
  });

  it("fällt bei einem gesetzten, unbrauchbaren Header NICHT auf DEV_USER_EMAIL zurück", async () => {
    // Ein gesetzter Header ist eine Identitätsbehauptung. Ist sie unlesbar,
    // ist das ein Fehler und kein Anlass, still jemand anders zu werden.
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_USER_EMAIL", "marc@example.com");
    currentHeaders = accessHeaders("kein-email-wert");
    await expect(requirePerson()).rejects.toBeInstanceOf(AuthError);
  });
});

describe("requirePerson — verbogene Header-Werte", () => {
  it("weist zwei Header-Instanzen ab", async () => {
    // Node fügt sie zu "a, b" zusammen. Sich daraus einen aussuchen
    // (`split(",")[0]`) würde bedeuten, dass man sich seine Identität
    // aussuchen kann.
    currentHeaders = accessHeaders("fremd@example.com", "marc@example.com");
    await expect(requirePerson()).rejects.toBeInstanceOf(AuthError);

    currentHeaders = accessHeaders("marc@example.com", "fremd@example.com");
    await expect(requirePerson()).rejects.toBeInstanceOf(AuthError);
  });

  it("weist eine Komma-Liste in einem Header ab", async () => {
    currentHeaders = rawHeader("marc@example.com,fremd@example.com");
    await expect(requirePerson()).rejects.toBeInstanceOf(AuthError);
  });

  it("weist Whitespace mitten im Wert ab", async () => {
    currentHeaders = rawHeader("marc @example.com");
    await expect(requirePerson()).rejects.toBeInstanceOf(AuthError);
  });

  it("weist einen Wert ohne @ oder ohne Domain-Punkt ab", async () => {
    for (const value of ["marc", "marc@example", "@example.com", "marc@"]) {
      currentHeaders = rawHeader(value);
      await expect(requirePerson()).rejects.toBeInstanceOf(AuthError);
    }
  });
});

describe("requirePerson — Unicode", () => {
  // Eine dritte Zeile nur für diesen Test: geprüft wird die Reihenfolge
  // "ASCII-Prüfung VOR toLowerCase()", und dafür braucht die Allowlist eine
  // Adresse mit `k` darin.
  beforeEach(() => {
    sqlite
      .prepare(
        "INSERT INTO person (id, email, name, partner_id, created_at) VALUES ('mark', 'mark@example.com', 'Mark', NULL, 0)",
      )
      .run();
  });

  afterEach(() => {
    sqlite.prepare("DELETE FROM person WHERE id = 'mark'").run();
  });

  it("weist das Kelvin-Zeichen ab, das auf ASCII k kleingeschrieben würde", async () => {
    // `"K".toLowerCase() === "k"`. Würde erst kleingeschrieben und dann
    // geprüft, träfe diese Adresse die Allowlist-Zeile `mark@example.com`.
    expect("K".toLowerCase()).toBe("k");

    currentHeaders = rawHeader("marK@example.com");
    await expect(requirePerson()).rejects.toBeInstanceOf(AuthError);

    // Gegenprobe: die echte Adresse geht durch, der Test ist also nicht
    // deshalb grün, weil die Zeile fehlt.
    currentHeaders = rawHeader("mark@example.com");
    expect((await requirePerson()).me.name).toBe("Mark");
  });

  it("weist eine Adresse mit Nicht-ASCII-Zeichen ab", async () => {
    currentHeaders = rawHeader("mårc@example.com");
    await expect(requirePerson()).rejects.toBeInstanceOf(AuthError);
  });
});

describe("requirePerson — Partnerverknüpfung", () => {
  afterEach(() => {
    // Verknüpfung wiederherstellen, damit die Reihenfolge der Tests egal ist.
    bootstrapPeople(sqlite);
  });

  it("gibt keinen Partner zurück, wenn jemand auf sich selbst zeigt", async () => {
    // Fehlkonfiguration: dieselbe Adresse zweimal in ACC_PEOPLE. Sein eigener
    // Partner zu sein würde die Anchoring-Sperre aushebeln — man sähe die
    // eigenen Antworten als die des Partners.
    sqlite
      .prepare("UPDATE person SET partner_id = id WHERE email = ?")
      .run("marc@example.com");

    currentHeaders = accessHeaders("marc@example.com");
    expect((await requirePerson()).partner).toBeNull();
  });

  it("gibt keinen Partner zurück, wenn die Verknüpfung ins Leere zeigt", async () => {
    sqlite
      .prepare("UPDATE person SET partner_id = 'weg' WHERE email = ?")
      .run("marc@example.com");

    currentHeaders = accessHeaders("marc@example.com");
    expect((await requirePerson()).partner).toBeNull();
  });
});

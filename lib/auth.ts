import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db, schema } from "@/db/index.ts";

/**
 * Die Identität kommt aus Cloudflare Access (PRD 08). Kein eigener Login, kein
 * Passwort, keine Session-Tabelle.
 *
 * Access setzt bei jeder Anfrage `Cf-Access-Authenticated-User-Email`. Der
 * Container hört nur auf `127.0.0.1:8100` und wird ausschließlich von
 * `cloudflared` erreicht — von außen kann der Header also nicht gesetzt werden,
 * weil von außen niemand direkt an den Port kommt.
 *
 * Der bewusst akzeptierte Rest: wer auf dem Pi selbst Zugriff hat, kommt ohne
 * weitere Hürde herein. Bei zwei Nutzern auf privater Hardware ist das
 * entschieden, nicht übersehen.
 *
 * Alles hier drin fällt im Zweifel zu — jeder Zweifelsfall endet in `null` und
 * damit in `AuthError`, niemals in einem geratenen Nutzer.
 */
const ACCESS_HEADER = "cf-access-authenticated-user-email";

/**
 * Genau eine E-Mail-Adresse, nur ASCII.
 *
 * Bewusst streng, und zwar gegen drei konkrete Fälle:
 *
 * - **Mehrere Header-Instanzen.** Kommen zwei `Cf-Access-…`-Header an, fügt
 *   Node sie zu `"a@x.de, b@y.de"` zusammen. Komma und Leerzeichen sind hier
 *   nicht erlaubt, der Wert fliegt also raus. Das ist die richtige Richtung:
 *   `split(",")[0]` würde sich aussuchen lassen, wer man ist.
 * - **Unicode-Homoglyphen.** `toLowerCase()` bildet U+212A (Kelvin-Zeichen) auf
 *   ASCII `k` ab. Deshalb wird **vor** dem Kleinschreiben auf ASCII geprüft:
 *   sonst könnte `marK@x.de` auf `mark@x.de` in der Allowlist treffen.
 *   Aus demselben Grund wird nirgends NFKC-normalisiert — das würde die
 *   Allowlist aufweichen statt sie zu schärfen.
 * - **Whitespace.** Node streift OWS um Header-Werte schon ab; ein Leerzeichen
 *   mitten drin nicht. Auch das ist kein gültiger Treffer.
 *
 * Preis: eine exotische, aber gültige Adresse (`!#$%&'*+/=?^_` im lokalen Teil)
 * würde abgewiesen. Das ist bei zwei bekannten Adressen kein Risiko und steht
 * im Log, ist also in einem Blick zu sehen statt zu rätseln.
 */
const ONE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export type Person = typeof schema.person.$inferSelect;

/** Ein brauchbarer Adresswert, kleingeschrieben — oder `null`. */
function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!ONE_EMAIL.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

/**
 * Der lokale Entwicklungsnutzer, oder `null`.
 *
 * Positivliste statt `!== "production"`: ein leeres oder unerwartetes
 * `NODE_ENV` — `node server.js` ohne gesetzte Variable ist genau das — gilt
 * damit nicht als "nicht Produktion". Die frühere Formulierung hätte in diesem
 * Fall einen Ersatznutzer erlaubt, und ein fehlender Access-Header wäre stiller
 * Vollzugriff geworden statt eines Fehlers.
 */
function devEmail(): string | null {
  const env = process.env.NODE_ENV;
  if (env !== "development" && env !== "test") return null;
  return normalizeEmail(process.env.DEV_USER_EMAIL);
}

/** Die E-Mail des Anfragenden, oder null. */
async function emailFromRequest(): Promise<string | null> {
  const h = await headers();
  const raw = h.get(ACCESS_HEADER);

  // Ein vorhandener Header ist die Antwort — auch wenn er unbrauchbar ist.
  // Sonst würde ein kaputter Header lokal still zum Entwicklungsnutzer werden,
  // und die Prüfung wäre dann genau in dem Moment weich, in dem sie greifen
  // müsste.
  if (raw !== null && raw.trim() !== "") {
    const email = normalizeEmail(raw);
    // Nur die Länge, nicht der Inhalt: ein beliebiger Header-Wert darf keine
    // Zeilenumbrüche in das Container-Log schreiben können.
    if (!email) {
      console.warn(`[auth] Access-Header unbrauchbar (${raw.length} Zeichen)`);
    }
    return email;
  }

  return devEmail();
}

/**
 * Die angemeldete Person samt Partner.
 *
 * Wirft, wenn die Adresse nicht in der Datenbank steht. Das ist die zweite Tür
 * hinter Access: die Personen-Tabelle ist die Allowlist. Auf diesem Pi standen
 * bereits dreimal Access-Anwendungen ohne Policy offen (siehe die Port-Karte
 * im pi-deploy-Skill) — eine App, die sich allein auf Access verlässt, wäre
 * dann offen.
 */
export async function requirePerson(): Promise<{
  me: Person;
  partner: Person | null;
}> {
  const email = await emailFromRequest();
  if (!email) throw new AuthError("Nicht angemeldet");

  const me = await db.query.person.findFirst({
    where: eq(schema.person.email, email),
  });
  if (!me) {
    // Die abgewiesene Adresse gehört ins Log, nicht in die Antwort: die Layouts
    // rendern `error.message`, und Eingaben sollen nicht in der Seite landen.
    // Der Wert ist hier garantiert eine saubere ASCII-Adresse ohne Whitespace,
    // kann also kein Log-Eintrag fälschen.
    console.warn(`[auth] Keine Person für ${email}`);
    // Formulierung so, dass sie unter der Überschrift "Kein Zugang" in beiden
    // Layouts als Satz funktioniert, ohne sie zu wiederholen.
    throw new AuthError("Diese Adresse ist hier nicht eingetragen");
  }

  // `partnerId !== me.id` fängt eine Fehlkonfiguration ab: stehen in
  // `ACC_PEOPLE` zweimal dieselbe Adresse, verknüpft `bootstrapPeople` die
  // Person mit sich selbst. Ohne diese Bedingung wäre man sein eigener Partner
  // und würde die eigenen Antworten als die des Partners angezeigt bekommen —
  // die Anchoring-Sperre aus PRD 02 wäre damit wirkungslos.
  const partner =
    me.partnerId && me.partnerId !== me.id
      ? ((await db.query.person.findFirst({
          where: eq(schema.person.id, me.partnerId),
        })) ?? null)
      : null;

  return { me, partner };
}

export class AuthError extends Error {
  readonly status = 403;
}

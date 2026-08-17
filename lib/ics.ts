/**
 * Der feste Wochentermin als iCalendar-Datei (PRD 07, Teil B, Stufe 1).
 *
 * Stufe 1 heißt ausdrücklich: eine Datei, die Marc und Chris je einmal
 * importieren. Kein Google-OAuth, kein Token-Store, kein Fehlerpfad — das ist
 * Stufe 2 und wartet, bis das Verschieben in der Praxis wirklich nervt.
 *
 * Warum das eine eigene Datei mit Tests ist: an einer .ics gehen genau vier
 * Dinge still schief, und jedes davon fällt erst im fremden Kalender auf, wo
 * man es nicht debuggen kann.
 *
 * 1. **Zeilenenden.** RFC 5545 schreibt CRLF vor. Mit `\n` importiert Google
 *    die Datei trotzdem, Apple Kalender lehnt sie je nach Version ab.
 * 2. **Zeilenlänge.** Über 75 Oktetts muss gefaltet werden. Ungefaltet
 *    schneiden strenge Parser den Rest der Zeile ab — die Beschreibung ist dann
 *    halb da.
 * 3. **Escaping.** Ein Komma in SUMMARY ist ohne Backslash ein Trennzeichen.
 *    Der Text bricht dann nicht, er wird stillschweigend zu zwei Werten.
 * 4. **Zeitzone.** Ein Termin in „floating time“ (ohne TZID, ohne Z) liegt
 *    immer 19:00 Ortszeit des Betrachters. Ein Termin in UTC (`…T170000Z`)
 *    liegt nach der Zeitumstellung plötzlich 18:00 Berliner Zeit. Beides ist
 *    falsch: gewollt ist 19:00 Europe/Berlin, das ganze Jahr. Deshalb
 *    `DTSTART;TZID=Europe/Berlin` **plus** ein VTIMEZONE-Block, damit auch ein
 *    Client ohne Zeitzonendatenbank denselben Zeitpunkt errechnet.
 */

import { sundayOf } from "./week.ts";

/**
 * Sonntag ist der Review-Tag (`docs/notes/08-offene-fragen.md`, N1). Die Woche
 * läuft Montag bis Sonntag, der Abschluss liegt an ihrem letzten Tag.
 */
const BYDAY = "SU";

/**
 * Der Anker der Serie, als Wochenschlüssel — nicht „der nächste Sonntag“.
 *
 * Ein aus `new Date()` berechneter Anker würde bei jedem Abruf einen anderen
 * DTSTART liefern. Wer die Datei zweimal importiert, hätte zwei Serien mit
 * derselben UID, und Kalender lösen das unterschiedlich auf. Ein fester Anker
 * in der Vergangenheit ist für eine wöchentliche Serie vollkommen normal.
 */
const ANCHOR_WEEK = "2026-W34";

/**
 * 19:00 bis 19:30 Berliner Zeit.
 *
 * Zwischen den beiden Zeitpunkten aus PRD 07 Teil A: der Loop ist ab 10:00
 * offen, um 20:00 kommt die letzte Erinnerung. Der gemeinsame Termin liegt
 * davor, damit beide zum Reden noch ausgefüllt haben. Eine halbe Stunde, weil
 * der Loop je fünf Minuten dauert und der Rest Gespräch ist.
 */
const START_HOUR = 19;
const START_MINUTE = 0;
const DURATION_MINUTES = 30;

/**
 * Die UID identifiziert die Serie über Importe hinweg. Sie ist eine Konstante
 * und kein `randomUUID()`: bei einer zufälligen UID legt ein zweiter Import
 * einen zweiten Termin an, statt den vorhandenen zu aktualisieren.
 */
const UID = "wochenreview-sonntag@accountability.marcbaumholz.de";

const PRODID = "-//Accountability//Wochenreview//DE";

const SUMMARY = "Wochenreview";

const DESCRIPTION =
  "Der feste Termin für die Woche. Erst jeder allein den Loop, dann kurz " +
  "telefonieren.";

const APP_URL = "https://accountability.marcbaumholz.de/";

/** Erinnerung des Kalenders selbst, 30 Minuten vorher. */
const ALARM_MINUTES_BEFORE = 30;

/**
 * Europe/Berlin, ausgeschrieben.
 *
 * Die EU-Regel: letzter Sonntag im März 01:00 UTC vor auf Sommerzeit, letzter
 * Sonntag im Oktober 01:00 UTC zurück. In Ortszeit der jeweils *geltenden*
 * Zone — und das ist der Haken — heißt das 02:00 im März (noch MEZ) und 03:00
 * im Oktober (noch MESZ). Wer beide auf 02:00 setzt, verschiebt den
 * Herbstwechsel um eine Stunde.
 */
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Berlin",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/**
 * Escaping für TEXT-Werte (RFC 5545, 3.3.11).
 *
 * Reihenfolge ist nicht beliebig: der Backslash muss zuerst verdoppelt werden,
 * sonst verdoppelt der Schritt die Backslashes, die die späteren Schritte
 * gerade eingefügt haben. Der Doppelpunkt wird **nicht** escaped — in einem
 * Wert ist er ein gewöhnliches Zeichen.
 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * Faltet eine Inhaltszeile auf höchstens 75 Oktetts.
 *
 * Zwei Feinheiten, die eine naive Implementierung falsch macht:
 *
 * - **Oktetts, nicht Zeichen.** „ä“ ist ein Zeichen und zwei Bytes. Eine
 *   Faltung nach 75 *Zeichen* erzeugt in deutschem Text zu lange Zeilen.
 * - **Das Fortsetzungszeichen zählt mit.** Die Folgezeile beginnt mit einem
 *   Leerzeichen, das zu den 75 Oktetts gehört — also 74 Nutzbytes.
 *
 * Geschnitten wird nur zwischen Codepoints. Mitten in eine UTF-8-Sequenz zu
 * schneiden ergäbe eine Datei, die kein Parser mehr lesen kann.
 */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
      limit = 74;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);

  return parts.join("\r\n ");
}

const pad = (value: number) => String(value).padStart(2, "0");

/** `20260817T143000Z` — der Zeitstempel der Erzeugung, immer in UTC. */
function utcStamp(at: Date): string {
  return (
    `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}` +
    `T${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}${pad(at.getUTCSeconds())}Z`
  );
}

/**
 * `20260823T190000` — Ortszeit, ohne Z. Gehört zwingend mit `TZID=` zusammen.
 *
 * `sundayOf` liefert den Kalendertag als UTC-Mitternacht (siehe `week.ts`);
 * gelesen werden hier nur Jahr, Monat und Tag daraus. Die Uhrzeit kommt aus den
 * Konstanten oben, nicht aus dem Date — sonst würde die Sommerzeit des
 * Erzeugungszeitpunkts in den Termin einsickern.
 */
function localStamp(day: Date, hour: number, minute: number): string {
  return (
    `${day.getUTCFullYear()}${pad(day.getUTCMonth() + 1)}${pad(day.getUTCDate())}` +
    `T${pad(hour)}${pad(minute)}00`
  );
}

/** Faltet alle Zeilen, hängt CRLF an — auch an die letzte. */
function serialize(lines: readonly string[]): string {
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export type CalendarOptions = {
  /** Zeitpunkt der Erzeugung, für DTSTAMP. Injizierbar, damit Tests fest sind. */
  now?: Date;
  summary?: string;
  description?: string;
};

/**
 * Die komplette Kalenderdatei für den wöchentlichen Review-Termin.
 *
 * Genau ein VEVENT mit einer RRULE, kein Termin pro Woche. Eine Serie ist eine
 * Zeile; ausgeschriebene Einzeltermine wären eine Datei, die irgendwann endet
 * und dann still keine Erinnerung mehr auslöst.
 */
export function weeklyReviewCalendar(options: CalendarOptions = {}): string {
  const now = options.now ?? new Date();
  const anchor = sundayOf(ANCHOR_WEEK);

  const endMinutes = START_HOUR * 60 + START_MINUTE + DURATION_MINUTES;

  return serialize([
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...VTIMEZONE,
    "BEGIN:VEVENT",
    `UID:${UID}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART;TZID=Europe/Berlin:${localStamp(anchor, START_HOUR, START_MINUTE)}`,
    `DTEND;TZID=Europe/Berlin:${localStamp(
      anchor,
      Math.floor(endMinutes / 60),
      endMinutes % 60,
    )}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY}`,
    "SEQUENCE:0",
    "TRANSP:OPAQUE",
    `SUMMARY:${escapeText(options.summary ?? SUMMARY)}`,
    `DESCRIPTION:${escapeText(options.description ?? DESCRIPTION)}`,
    // URL ist vom Typ URI, nicht TEXT — hier wird nicht escaped.
    `URL:${APP_URL}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `TRIGGER:-PT${ALARM_MINUTES_BEFORE}M`,
    `DESCRIPTION:${escapeText(SUMMARY)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]);
}

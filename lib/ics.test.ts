import { describe, expect, it } from "vitest";

import { escapeText, foldLine, weeklyReviewCalendar } from "./ics.ts";

const NOW = new Date("2026-08-17T14:30:05Z");

/* ------------------------------------------------------------------ *
 * Ein kleiner Parser, damit die Tests die Datei lesen wie ein Client *
 * ------------------------------------------------------------------ */

type Prop = { name: string; params: Record<string, string>; value: string };

/**
 * Zerlegt die Datei so, wie RFC 5545 sie vorschreibt: an CRLF trennen, Zeilen
 * entfalten, die mit einem Leerzeichen beginnen, dann Name/Parameter/Wert.
 *
 * Bewusst kein Regex über den ganzen Text: die Tests sollen prüfen, was ein
 * Parser sieht, nicht ob eine Zeichenkette irgendwo vorkommt.
 */
function parse(text: string): Prop[] {
  expect(text.endsWith("\r\n")).toBe(true);
  // Ein einzelnes \n ohne \r wäre der klassische Fehler.
  expect(text.replace(/\r\n/g, "")).not.toContain("\n");

  const raw = text.slice(0, -2).split("\r\n");
  const unfolded: string[] = [];
  for (const line of raw) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      expect(unfolded.length).toBeGreaterThan(0);
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  return unfolded.map((line) => {
    const colon = line.indexOf(":");
    expect(colon).toBeGreaterThan(0);
    const [name, ...paramParts] = line.slice(0, colon).split(";");
    const params: Record<string, string> = {};
    for (const part of paramParts) {
      const eq = part.indexOf("=");
      params[part.slice(0, eq)] = part.slice(eq + 1);
    }
    return { name, params, value: line.slice(colon + 1) };
  });
}

function valueOf(props: Prop[], name: string): string {
  const found = props.filter((p) => p.name === name);
  expect(found).toHaveLength(1);
  return found[0].value;
}

function propOf(props: Prop[], name: string): Prop {
  const found = props.filter((p) => p.name === name);
  expect(found).toHaveLength(1);
  return found[0];
}

/** Der Abschnitt zwischen BEGIN:X und END:X, verschachtelte Blöcke inklusive. */
function component(props: Prop[], name: string): Prop[] {
  const start = props.findIndex((p) => p.name === "BEGIN" && p.value === name);
  const end = props.findIndex((p) => p.name === "END" && p.value === name);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return props.slice(start + 1, end);
}

/**
 * Nur die eigenen Eigenschaften, ohne die der verschachtelten Blöcke.
 *
 * Nötig, weil VALARM im VEVENT liegt und selbst eine DESCRIPTION hat: ohne
 * diesen Filter fände ein Test zwei Beschreibungen und wüsste nicht, welche
 * gemeint ist.
 */
function direct(props: Prop[]): Prop[] {
  let depth = 0;
  return props.filter((prop) => {
    if (prop.name === "BEGIN") {
      depth += 1;
      return false;
    }
    if (prop.name === "END") {
      depth -= 1;
      return false;
    }
    return depth === 0;
  });
}

/* ---------------------------------------------- *
 * Echte Zeitzonen-Wahrheit, gegen die wir testen *
 * ---------------------------------------------- */

const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Berlin",
  timeZoneName: "longOffset",
});

/** Der tatsächliche Berliner UTC-Abstand in Minuten zu einem Zeitpunkt. */
function berlinOffsetMinutes(at: Date): number {
  const name = offsetFormat
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? "");
  if (!match) throw new Error(`Kein Offset lesbar: ${name}`);
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** Der UTC-Zeitpunkt einer Berliner Wandzeit. */
function berlinInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const first = new Date(asUtc - berlinOffsetMinutes(new Date(asUtc)) * 60_000);
  // Zweiter Durchgang: der Offset am geschätzten Zeitpunkt kann von dem am
  // naiven abweichen, wenn dazwischen ein Wechsel liegt.
  return new Date(asUtc - berlinOffsetMinutes(first) * 60_000);
}

/** `20260823T190000` in seine Bestandteile. */
function parseStamp(stamp: string) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(stamp);
  if (!match) throw new Error(`Kein Zeitstempel: ${stamp}`);
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    utc: match[7] === "Z",
  };
}

/* ----- *
 * Tests *
 * ----- */

describe("escapeText", () => {
  it("escaped die vier Zeichen, die RFC 5545 nennt", () => {
    expect(escapeText("a,b;c\\d")).toBe("a\\,b\\;c\\\\d");
  });

  it("macht aus einem Umbruch ein \\n im Wert", () => {
    expect(escapeText("Zeile 1\nZeile 2")).toBe("Zeile 1\\nZeile 2");
    expect(escapeText("Zeile 1\r\nZeile 2")).toBe("Zeile 1\\nZeile 2");
  });

  it("verdoppelt den Backslash zuerst und nicht zuletzt", () => {
    // Falsche Reihenfolge ergäbe hier "\\\\," statt "\\\\\\,": der Backslash,
    // der das Komma escaped, würde selbst noch verdoppelt.
    expect(escapeText("\\,")).toBe("\\\\\\,");
  });

  it("lässt den Doppelpunkt in Ruhe", () => {
    expect(escapeText("19:00")).toBe("19:00");
  });
});

describe("foldLine", () => {
  it("lässt kurze Zeilen unverändert", () => {
    expect(foldLine("SUMMARY:Wochenreview")).toBe("SUMMARY:Wochenreview");
  });

  it("faltet nach 75 Oktetts, Folgezeilen beginnen mit einem Leerzeichen", () => {
    const folded = foldLine(`X:${"a".repeat(120)}`);
    const lines = folded.split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveLength(75);
    expect(lines[1].startsWith(" ")).toBe(true);
    // Entfaltet muss wieder genau der Eingang herauskommen.
    expect(lines[0] + lines[1].slice(1)).toBe(`X:${"a".repeat(120)}`);
  });

  it("zählt Oktetts, nicht Zeichen", () => {
    // 40 Umlaute sind 80 Bytes und müssen gefaltet werden, obwohl es nur
    // 40 Zeichen sind.
    const lines = foldLine("ä".repeat(40)).split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("schneidet nie mitten in ein Mehrbyte-Zeichen", () => {
    const folded = foldLine("ü".repeat(60));
    // Ein Schnitt innerhalb der UTF-8-Sequenz erzeugte hier ein
    // Ersatzzeichen beim Dekodieren.
    expect(folded).not.toContain("�");
    expect(folded.split("\r\n").map((l) => l.replace(/^ /, "")).join("")).toBe(
      "ü".repeat(60),
    );
  });

  it("hält jede Zeile der echten Datei unter 76 Oktetts", () => {
    const encoderLocal = new TextEncoder();
    for (const line of weeklyReviewCalendar({ now: NOW }).split("\r\n")) {
      expect(encoderLocal.encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});

describe("weeklyReviewCalendar — Struktur", () => {
  const props = parse(weeklyReviewCalendar({ now: NOW }));

  it("ist ein VCALENDAR mit Version und PRODID", () => {
    expect(props[0]).toMatchObject({ name: "BEGIN", value: "VCALENDAR" });
    expect(props[props.length - 1]).toMatchObject({
      name: "END",
      value: "VCALENDAR",
    });
    expect(valueOf(props, "VERSION")).toBe("2.0");
    expect(valueOf(props, "PRODID")).toContain("Accountability");
  });

  it("hat jedes BEGIN mit einem END gepaart", () => {
    const stack: string[] = [];
    for (const prop of props) {
      if (prop.name === "BEGIN") stack.push(prop.value);
      if (prop.name === "END") expect(stack.pop()).toBe(prop.value);
    }
    expect(stack).toEqual([]);
  });

  it("enthält genau ein VEVENT mit stabiler UID und DTSTAMP in UTC", () => {
    expect(props.filter((p) => p.value === "VEVENT" && p.name === "BEGIN"))
      .toHaveLength(1);
    const event = direct(component(props, "VEVENT"));

    expect(valueOf(event, "UID")).toBe(
      "wochenreview-sonntag@accountability.marcbaumholz.de",
    );
    expect(valueOf(event, "DTSTAMP")).toBe("20260817T143005Z");
    expect(parseStamp(valueOf(event, "DTSTAMP")).utc).toBe(true);
  });

  it("wiederholt sich wöchentlich am Sonntag", () => {
    expect(valueOf(direct(component(props, "VEVENT")), "RRULE")).toBe(
      "FREQ=WEEKLY;BYDAY=SU",
    );
  });

  it("dauert eine halbe Stunde", () => {
    const event = direct(component(props, "VEVENT"));
    expect(valueOf(event, "DTSTART")).toBe("20260823T190000");
    expect(valueOf(event, "DTEND")).toBe("20260823T193000");
  });

  it("bleibt über Abrufe hinweg identisch, außer im DTSTAMP", () => {
    // Zwei Importe derselben Serie dürfen nicht zwei Termine ergeben.
    const a = parse(weeklyReviewCalendar({ now: NOW }));
    const b = parse(
      weeklyReviewCalendar({ now: new Date("2027-03-01T08:00:00Z") }),
    );
    const strip = (list: Prop[]) =>
      list.filter((p) => p.name !== "DTSTAMP").map((p) => p.value);
    expect(strip(a)).toEqual(strip(b));
  });

  it("trägt eine eigene Erinnerung, damit die Datei ohne Push erinnert", () => {
    expect(valueOf(component(props, "VALARM"), "TRIGGER")).toBe("-PT30M");
  });
});

describe("weeklyReviewCalendar — Escaping im echten Text", () => {
  it("escaped Kommas in der Beschreibung", () => {
    const event = direct(
      component(parse(weeklyReviewCalendar({ now: NOW })), "VEVENT"),
    );
    const description = valueOf(event, "DESCRIPTION");
    // Der echte Text enthält ein Komma. Unescaped wäre er für einen Parser
    // zwei Werte, nicht einer.
    expect(description).toContain("\\,");
    expect(/(^|[^\\]),/.test(description)).toBe(false);
  });

  it("hält Sonderzeichen aus einem übergebenen Text aus der Syntax heraus", () => {
    const props = parse(
      weeklyReviewCalendar({
        now: NOW,
        summary: "Review; kurz, ehrlich\\offen",
        description: "Zeile 1\nZeile 2",
      }),
    );
    const event = direct(component(props, "VEVENT"));
    expect(valueOf(event, "SUMMARY")).toBe(
      "Review\\; kurz\\, ehrlich\\\\offen",
    );
    expect(valueOf(event, "DESCRIPTION")).toBe("Zeile 1\\nZeile 2");
    // Und die Struktur ist davon unberührt: kein Wert hat eine Zeile gesprengt.
    expect(props.filter((p) => p.name === "SUMMARY")).toHaveLength(1);
  });
});

describe("weeklyReviewCalendar — Sommerzeit", () => {
  const props = parse(weeklyReviewCalendar({ now: NOW }));
  const event = direct(component(props, "VEVENT"));
  const zone = component(props, "VTIMEZONE");

  it("bindet DTSTART an Europe/Berlin, nicht an UTC und nicht an floating time", () => {
    const start = propOf(event, "DTSTART");
    expect(start.params.TZID).toBe("Europe/Berlin");
    expect(start.value.endsWith("Z")).toBe(false);
    expect(valueOf(zone, "TZID")).toBe("Europe/Berlin");
  });

  it("liegt im Sommer und im Winter auf derselben Ortszeit", () => {
    const { hour, minute } = parseStamp(valueOf(event, "DTSTART"));
    const local = new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    // 23.08.2026 ist der Anker (Sommerzeit), 15.11.2026 ein Sonntag danach
    // (Winterzeit). Beide Vorkommen müssen 19:00 Berliner Zeit sein.
    const summer = berlinInstant(2026, 8, 23, hour, minute);
    const winter = berlinInstant(2026, 11, 15, hour, minute);
    expect(local.format(summer)).toBe("19:00");
    expect(local.format(winter)).toBe("19:00");

    // Und genau deshalb sind die absoluten Zeitpunkte verschieden: 17:00 UTC
    // im Sommer, 18:00 UTC im Winter. Ein Termin in UTC hätte hier zweimal
    // dieselbe Zahl und läge im Winter eine Stunde früher.
    expect(summer.toISOString()).toBe("2026-08-23T17:00:00.000Z");
    expect(winter.toISOString()).toBe("2026-11-15T18:00:00.000Z");
  });

  it("beschreibt mit VTIMEZONE dieselben Wechsel wie die echte Zone", () => {
    // Aus dem Block gelesen, nicht hart eingetippt: der Wechsel gilt am
    // letzten Sonntag des Monats zur angegebenen Ortszeit, gerechnet im
    // Offset, der davor gilt.
    const cases = [
      { part: "DAYLIGHT", month: 3, before: 60, after: 120 },
      { part: "STANDARD", month: 10, before: 120, after: 60 },
    ] as const;

    for (const { part, month, before, after } of cases) {
      const block = direct(component(zone, part));
      const rule = valueOf(block, "RRULE");
      expect(rule).toBe(`FREQ=YEARLY;BYMONTH=${month};BYDAY=-1SU`);

      const from = valueOf(block, "TZOFFSETFROM");
      const to = valueOf(block, "TZOFFSETTO");
      expect(minutesOfOffset(from)).toBe(before);
      expect(minutesOfOffset(to)).toBe(after);

      // Letzter Sonntag des Monats 2026, zur Ortszeit aus DTSTART, im
      // Offset TZOFFSETFROM: das ist der Umschaltmoment in UTC.
      const { hour, minute } = parseStamp(valueOf(block, "DTSTART"));
      const day = lastSundayOfMonth(2026, month);
      const at = new Date(
        Date.UTC(2026, month - 1, day, hour, minute) - before * 60_000,
      );

      expect(berlinOffsetMinutes(new Date(at.getTime() - 60_000))).toBe(before);
      expect(berlinOffsetMinutes(at)).toBe(after);
    }
  });
});

function minutesOfOffset(value: string): number {
  const match = /^([+-])(\d{2})(\d{2})$/.exec(value);
  if (!match) throw new Error(`Kein Offset: ${value}`);
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function lastSundayOfMonth(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month, 0));
  return last.getUTCDate() - last.getUTCDay();
}

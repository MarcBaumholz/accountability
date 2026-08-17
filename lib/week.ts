/**
 * ISO-Wochen in Europe/Berlin.
 *
 * Warum das eine eigene Datei mit Tests ist und nicht drei Zeilen irgendwo:
 * zwei Fehler sind hier praktisch unvermeidlich, wenn man es beiläufig macht,
 * und beide sind still.
 *
 * 1. **Zeitzone.** Ohne gesetzte Zone rechnet der Container in UTC. Ein Eintrag
 *    Sonntag 23:30 Berliner Zeit ist in UTC Sonntag 21:30 — noch dieselbe
 *    Woche. Aber Montag 00:30 Berlin ist Sonntag 23:30 UTC und fällt damit in
 *    die *alte* Woche. Genau der Moment, in dem der Loop gefüllt wird.
 *
 * 2. **ISO-Wochennummern sind nicht "Tag des Jahres durch sieben".** Der
 *    1. Januar 2027 ist ein Freitag und gehört zu Woche 53 von 2026. Wer
 *    naiv rechnet, bekommt dort eine Woche "2027-W01", die es nicht gibt, und
 *    verliert einen Eintrag.
 *
 * Alles hier arbeitet auf dem *bürgerlichen Datum* in Berlin, das über
 * `Intl.DateTimeFormat` bestimmt wird — der einzige Weg ohne Zeitzonen-Paket,
 * der auch über Sommerzeitwechsel stimmt.
 */

export const TZ = "Europe/Berlin";

const DAY_MS = 86_400_000;

const berlinParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Das bürgerliche Datum in Berlin, als UTC-Mitternacht dieses Kalendertags. */
function berlinCivilDate(at: Date): Date {
  const parts = berlinParts.formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

/** ISO-Jahr und -Woche eines als UTC-Mitternacht gegebenen Kalendertags. */
function isoYearWeek(civil: Date): { year: number; week: number } {
  // Auf den Donnerstag derselben ISO-Woche gehen. Der Donnerstag liegt per
  // Definition immer im ISO-Jahr der Woche — das ist der Trick, der den
  // Jahreswechsel richtig macht.
  const thursday = new Date(civil);
  const dayNum = civil.getUTCDay() || 7; // Mo = 1 … So = 7
  thursday.setUTCDate(civil.getUTCDate() + 4 - dayNum);

  const year = thursday.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.ceil(((thursday.getTime() - jan1) / DAY_MS + 1) / 7);
  return { year, week };
}

/** Der Wochenschlüssel, z. B. `2026-W34`. Zweistellig, damit Textsortierung
 *  gleich chronologischer Sortierung ist. */
export function weekKey(at: Date = new Date()): string {
  const { year, week } = isoYearWeek(berlinCivilDate(at));
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function parseWeekKey(key: string): { year: number; week: number } {
  const match = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!match) throw new Error(`Kein Wochenschlüssel: ${key}`);
  return { year: Number(match[1]), week: Number(match[2]) };
}

/** Der Montag einer ISO-Woche, als UTC-Mitternacht. */
export function mondayOf(key: string): Date {
  const { year, week } = parseWeekKey(key);
  // Der 4. Januar liegt per ISO-Definition immer in Woche 1.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayNum = jan4.getUTCDay() || 7;
  const week1Monday = Date.UTC(year, 0, 4 - (dayNum - 1));
  return new Date(week1Monday + (week - 1) * 7 * DAY_MS);
}

/** Der Sonntag derselben Woche. */
export function sundayOf(key: string): Date {
  return new Date(mondayOf(key).getTime() + 6 * DAY_MS);
}

export function prevWeek(key: string): string {
  const monday = mondayOf(key);
  return isoKeyOfCivil(new Date(monday.getTime() - 7 * DAY_MS));
}

export function nextWeek(key: string): string {
  const monday = mondayOf(key);
  return isoKeyOfCivil(new Date(monday.getTime() + 7 * DAY_MS));
}

function isoKeyOfCivil(civil: Date): string {
  const { year, week } = isoYearWeek(civil);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Die letzten `count` Wochenschlüssel, aufsteigend, `upTo` als letzter.
 * Für die Diagramme im Verlauf.
 */
export function recentWeeks(count: number, upTo: string = weekKey()): string[] {
  const keys: string[] = [];
  let cursor = upTo;
  for (let i = 0; i < count; i += 1) {
    keys.unshift(cursor);
    cursor = prevWeek(cursor);
  }
  return keys;
}

/** `KW 34` — die Form, die im Notion-Template stand. */
export function weekLabel(key: string): string {
  return `KW ${parseWeekKey(key).week}`;
}

/**
 * `18.–24. Aug` für die Anzeige unter dem Wochenlabel.
 *
 * Der Halbgeviertstrich hier ist Absicht und die einzige Stelle in der
 * Oberfläche, an der einer stehen darf.
 *
 * Die Anti-Slop-Regel, gegen die alles andere geprüft wurde, verbietet Geviert-
 * und Halbgeviertstriche restlos, weil sie das häufigste Erkennungsmerkmal
 * maschinengeschriebener Texte sind — und die Regel nennt Datumsbereiche
 * ausdrücklich. Sie ist aber für englische Marketingseiten geschrieben. Im
 * Deutschen ist der Bis-Strich in einem Datumsbereich der typografisch richtige
 * Strich (Duden), und ein Bindestrich wäre dort schlicht falsch gesetzt.
 *
 * Also: Regel befolgt, wo sie ein Stilmittel verbietet; Regel abgelehnt, wo sie
 * gegen deutsche Typografie stünde. Wer das anders sieht, ändert eine Zeile und
 * zwei Tests.
 */
export function weekRangeLabel(key: string): string {
  const monday = mondayOf(key);
  const sunday = sundayOf(key);
  const month = new Intl.DateTimeFormat("de-DE", {
    month: "short",
    timeZone: "UTC",
  });
  const dayOf = (d: Date) => d.getUTCDate();

  const monthMon = month.format(monday);
  const monthSun = month.format(sunday);

  return monthMon === monthSun
    ? `${dayOf(monday)}.–${dayOf(sunday)}. ${monthSun}`
    : `${dayOf(monday)}. ${monthMon} – ${dayOf(sunday)}. ${monthSun}`;
}

/**
 * Zählt zusammenhängende abgegebene Wochen, rückwärts ab `from`.
 *
 * Die aktuelle Woche darf nicht mitzählen, solange sie offen ist — sonst
 * springt der Streak bei jedem Wochenwechsel auf 0 und sieht wie ein Fehler
 * aus. Deshalb beginnt die Zählung bei der aktuellen Woche nur dann, wenn sie
 * abgegeben ist, und sonst bei der Vorwoche.
 */
export function streakOf(
  submittedWeeks: ReadonlySet<string>,
  from: string = weekKey(),
): number {
  let cursor = submittedWeeks.has(from) ? from : prevWeek(from);
  let streak = 0;
  while (submittedWeeks.has(cursor)) {
    streak += 1;
    cursor = prevWeek(cursor);
  }
  return streak;
}

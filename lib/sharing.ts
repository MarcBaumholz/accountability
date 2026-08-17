/**
 * Die Freigabe-Stufen (PRD 02).
 *
 * Warum das eine reine Funktion mit Tests ist und nicht ein `{visible && …}` im
 * JSX: das hier ist die einzige Regel in der App, deren Verletzung
 * unwiederbringlich ist. Wer Chris' Prios sieht, bevor er seine eigenen
 * geschrieben hat, kann das nicht mehr nicht-gesehen haben — der Wert der
 * Woche ist dann weg, egal ob es ein Bug war.
 *
 * Deshalb: eine Funktion, hier, mit einer Tabelle von Tests, und aufgerufen im
 * Server-Code, bevor Daten das Haus verlassen. Ausblenden im UI ist die zweite
 * Schicht, nicht die erste.
 */

/** `none` = überhaupt kein Eintrag in dieser Woche. */
export type EntryStatus = "none" | "draft" | "part1" | "submitted";

export type Visibility =
  /** Nur, *ob* der Partner dran ist — kein Inhalt. */
  | "status"
  /** Rückblick: Scores, Werte, Prio-Auswertung, Erfolge, Challenges, Weglassen. */
  | "part1"
  /** Alles, inklusive Identität, Vision, Prios und beider Empfehlungen. */
  | "all";

/**
 * Was ich vom Partner sehen darf.
 *
 * Die Asymmetrie ist beabsichtigt: Stufe 2 hängt an **meiner** Abgabe, nicht an
 * seiner. Wer zuerst fertig ist, hat sofort etwas zu lesen; wer zögert, sieht
 * nichts. Das ist die Peer-Pressure-Mechanik, und sie belohnt Schnelligkeit.
 */
export function partnerVisibility(
  mine: EntryStatus,
  theirs: EntryStatus,
): Visibility {
  // Stufe 1 — ich habe meinen Rückblick nicht abgegeben. Ich sehe keinen
  // Inhalt, damit ich meine Antworten nicht an seinen ausrichte.
  if (mine === "none" || mine === "draft") return "status";

  // Stufe 3 — beide komplett durch.
  if (mine === "submitted" && theirs === "submitted") return "all";

  // Stufe 2 — ich bin durch Teil 1, er mindestens auch.
  if (theirs === "part1" || theirs === "submitted") return "part1";

  // Er hat noch nichts freigegeben. Mein Loop läuft trotzdem weiter — die App
  // darf niemals blockieren, weil der Partner nicht liefert.
  return "status";
}

export function statusOf(
  entry: { status: "draft" | "part1" | "submitted" } | null | undefined,
): EntryStatus {
  return entry?.status ?? "none";
}

/** Der Text auf der Startseite. Verrät bewusst keinen Inhalt. */
export function statusLabel(status: EntryStatus): string {
  switch (status) {
    case "none":
      return "noch nicht angefangen";
    case "draft":
      return "ist dran";
    case "part1":
      return "Rückblick abgegeben";
    case "submitted":
      return "abgegeben";
  }
}

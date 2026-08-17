/**
 * Die Definition des Wochenloops (PRD 01): welche Schirme es gibt, in welcher
 * Reihenfolge, und welche in der Minimum-Version dabei sind.
 *
 * Diese Datei ist absichtlich Daten und keine Komponenten. Die Reihenfolge des
 * Loops ist eine Produktentscheidung mit Begründung pro Position
 * (`docs/notes/06-fragebogen.md`); sie soll an einer Stelle lesbar sein und
 * nicht über vierzehn JSX-Dateien verteilt.
 */

export type ScreenId =
  | "recap"
  | "lifescore"
  | "areas"
  | "values"
  | "prioReview"
  | "gapReason"
  | "wins"
  | "challenges"
  | "drop"
  | "identity"
  | "vision"
  | "prios"
  | "aarBetter"
  | "partner";

export type Part = 1 | 2;

export type Screen = {
  id: ScreenId;
  /** Teil 1 = Rückblick (wird für den Partner freigegeben), Teil 2 = Vorausschau. */
  part: Part;
  /** In der Minimum-Version enthalten. */
  minimal: boolean;
  question: string;
  /** Steht unter der Frage, wenn sie Erklärung braucht. */
  hint?: string;
};

/**
 * Die Reihenfolge. Regeln dahinter, jede aus den Notizen:
 *  - Rückblick zuerst, Vorausschau danach.
 *  - Am Anfang klicken (Slider, Auswahl), in der Mitte schreiben.
 *  - "weglassen" gehört in den ersten Teil, nicht ans Ende.
 *  - Identität VOR den Prios, weil sie das Prio-Setzen leichter macht.
 */
export const SCREENS: readonly Screen[] = [
  {
    id: "recap",
    part: 1,
    minimal: true,
    question: "Das hattest du dir vorgenommen",
    hint: "Nur zum Lesen. Gleich bewertest du es.",
  },
  {
    id: "lifescore",
    part: 1,
    minimal: true,
    question: "Wie zufrieden bist du mit deiner Woche?",
  },
  {
    id: "areas",
    part: 1,
    minimal: false,
    question: "Und nach Bereich?",
    hint: "Eine 7 gesamt sagt nicht, woher sie kommt.",
  },
  {
    id: "values",
    part: 1,
    minimal: true,
    question: "Hast du deine Werte gelebt?",
  },
  {
    id: "prioReview",
    part: 1,
    minimal: true,
    question: "Hast du deine Prios erreicht?",
  },
  {
    id: "gapReason",
    part: 1,
    minimal: false,
    question: "Warum die Lücke?",
    hint: "Nicht rechtfertigen. Nur benennen, was dazwischenkam.",
  },
  {
    id: "wins",
    part: 1,
    minimal: true,
    question: "Was ist dir gelungen?",
  },
  {
    id: "challenges",
    part: 1,
    minimal: false,
    question: "Was war schwierig?",
  },
  {
    id: "drop",
    part: 1,
    minimal: false,
    question: "Was hat sich unnötig angefühlt?",
    hint: "Was willst du nächste Woche weniger machen?",
  },
  {
    id: "identity",
    part: 2,
    minimal: true,
    question: "Wer willst du nächste Woche sein?",
    hint: "Ein Wort. Es macht das Prio-Setzen danach leichter.",
  },
  {
    id: "vision",
    part: 2,
    minimal: false,
    question: "Wie sieht eine gute nächste Woche aus?",
  },
  {
    id: "prios",
    part: 2,
    minimal: true,
    question: "Deine Prios",
    hint: "Höchstens drei. Nächste Woche bewertest du genau diese.",
  },
  {
    id: "aarBetter",
    part: 2,
    minimal: false,
    question: "Was machst du diesmal anders?",
  },
  {
    id: "partner",
    part: 2,
    minimal: true,
    question: "Die Woche deines Partners",
  },
] as const;

export const MODES = ["minimal", "full"] as const;
export type Mode = (typeof MODES)[number];

/** Harte Produktgrenzen (PRD 01). Nicht konfigurierbar — das ist Absicht. */
export const LIMITS = {
  prios: 3,
  identityChars: 40,
  textChars: 2000,
  itemChars: 200,
  valueLabelChars: 30,
  valueDescChars: 200,
  goalChars: 120,
  activeValues: 3,
} as const;

type Answers = {
  prioReviews: ReadonlyArray<{ result: "done" | "partly" | "missed" }>;
  hasPartnerPart1: boolean;
  hasValues: boolean;
  hasLastWeekPrios: boolean;
};

/**
 * Welche Schirme dieser Loop tatsächlich zeigt.
 *
 * Drei Arten von Auslassung, jede mit einem Grund:
 *  - Modus: die Minimum-Version zeigt nur die ★-Schirme.
 *  - Bedingt: "Warum die Lücke?" nur, wenn es eine Lücke gibt. Eine Woche, in
 *    der alles erreicht wurde, soll nicht nach einer Ausrede fragen.
 *  - Datenlage: kein Wert im Fundament, keine Prios in der Vorwoche, kein
 *    freigegebener Partner-Teil → der Schirm hätte nichts zu zeigen.
 */
export function visibleScreens(mode: Mode, answers: Answers): Screen[] {
  return SCREENS.filter((screen) => {
    if (mode === "minimal" && !screen.minimal) return false;

    switch (screen.id) {
      case "recap":
      case "prioReview":
        return answers.hasLastWeekPrios;
      case "gapReason":
        return answers.prioReviews.some((r) => r.result !== "done");
      case "values":
        return answers.hasValues;
      case "partner":
        return answers.hasPartnerPart1;
      default:
        return true;
    }
  });
}

/** Der letzte Schirm von Teil 1 — dort steht der Freigabe-Knopf. */
export function lastScreenOfPart1(screens: readonly Screen[]): ScreenId | null {
  const part1 = screens.filter((s) => s.part === 1);
  return part1.length > 0 ? part1[part1.length - 1].id : null;
}

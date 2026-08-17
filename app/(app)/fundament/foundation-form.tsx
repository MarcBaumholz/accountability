"use client";

import { Flag } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveFoundation } from "@/lib/actions.ts";
import { LIMITS } from "@/lib/loop.ts";
import { Group, Tile } from "../ui.tsx";

/** Anklickbare Startpunkte. Ein leeres Textfeld als erste Begegnung mit der App
 *  wäre der schlechteste mögliche Einstieg (PRD 03). */
const SUGGESTIONS = [
  "Gesundheit",
  "Handwerk",
  "Verbindung",
  "Freiraum",
  "Kreativität",
  "Ruhe",
] as const;

/**
 * Die Eingabe liegt in der Karte, nicht in einem Kästchen in der Karte.
 *
 * iOS-Formulare sind Listen: eine Zeile, links das Label oder die Kachel, rechts
 * das Feld ohne eigenen Rahmen. Ein `.field` in einer `.list` wären zwei
 * verschachtelte Karten — der Look, der die vorige Version "basic" aussehen
 * ließ.
 */
const INPUT =
  "w-full min-w-0 bg-transparent outline-none placeholder:text-[var(--label-3)]";

type Row = { id?: string; label: string; description: string };

export function FoundationForm({
  initialValues,
  initialGoals,
  firstRun,
}: {
  initialValues: Row[];
  initialGoals: string[];
  firstRun: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Row[]>(() =>
    Array.from(
      { length: LIMITS.activeValues },
      (_, i) => initialValues[i] ?? { label: "", description: "" },
    ),
  );
  const [goals, setGoals] = useState<string[]>(() =>
    initialGoals.length > 0 ? [...initialGoals, ""] : [""],
  );
  const [saved, setSaved] = useState(false);

  const filled = values.filter((v) => v.label.trim()).length;

  const submit = () =>
    startTransition(async () => {
      await saveFoundation(values, goals);
      setSaved(true);
      if (firstRun) router.push("/");
      else router.refresh();
    });

  const patch = (index: number, part: Partial<Row>) =>
    setValues((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...part };
      return next;
    });

  return (
    <div className="flex flex-col gap-7">
      <Group
        title="Deine drei Werte"
        note="Jede Woche bewertest du, wie sehr du sie gelebt hast. Drei, weil drei Kurven in einem Diagramm noch lesbar sind."
      >
        <div className="list">
          {values.map((row, index) => (
            // Kein `.row`: die Zeile ist zweizeilig, und `.row` zentriert
            // senkrecht und setzt eine eigene Polsterung. `row-inset` allein
            // liefert nur die eingerückte Trennlinie. Beide Felder sind 44 px
            // hoch und nicht textzeilenhoch: ein 22 px hohes Eingabefeld ist auf
            // dem Telefon eine Trefferfläche, die man verfehlt, und dann landet
            // die Beschreibung im Namensfeld.
            <div
              key={index}
              className="row-inset flex items-start gap-3 px-4"
            >
              <span className="pt-[7px]">
                <Tile color="var(--c-values)">
                  <span className="t-metric text-[13px]">{index + 1}</span>
                </Tile>
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <input
                  value={row.label}
                  maxLength={LIMITS.valueLabelChars}
                  placeholder={`Wert ${index + 1}`}
                  aria-label={`Wert ${index + 1}`}
                  className={`${INPUT} t-headline h-11`}
                  onChange={(e) => patch(index, { label: e.target.value })}
                />
                <input
                  value={row.description}
                  maxLength={LIMITS.valueDescChars}
                  placeholder="Woran du es merkst (optional)"
                  aria-label={`Beschreibung für Wert ${index + 1}`}
                  className={`${INPUT} t-subhead h-11 text-[var(--label-2)]`}
                  onChange={(e) => patch(index, { description: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      </Group>

      {filled === 0 && (
        <div className="flex flex-col gap-2">
          <p className="t-footnote px-4 text-[var(--label-2)]">
            Oder nimm einen davon als Anfang
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="t-subhead min-h-11 rounded-full px-4 font-medium"
                style={{ background: "var(--fill)", color: "var(--c-blue)" }}
                onClick={() =>
                  setValues((prev) => {
                    const next = [...prev];
                    const slot = next.findIndex((v) => !v.label.trim());
                    if (slot !== -1)
                      next[slot] = { ...next[slot], label: suggestion };
                    return next;
                  })
                }
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <Group
        title="Jahresziele"
        note="Optional. Sie stehen beim Prio-Setzen daneben, damit die Woche in eine Richtung zeigt."
      >
        <div className="list">
          {goals.map((goal, index) => (
            <div
              key={index}
              className="row-inset flex items-center gap-3 px-4"
            >
              <Tile color="var(--c-self)">
                <Flag size={15} weight="fill" />
              </Tile>
              <input
                value={goal}
                maxLength={LIMITS.goalChars}
                placeholder={
                  index === 0 ? "Eigene Projekte fertig bekommen" : "Noch ein Ziel"
                }
                aria-label={`Jahresziel ${index + 1}`}
                className={`${INPUT} t-body h-11`}
                onChange={(e) =>
                  setGoals((prev) => {
                    const next = [...prev];
                    next[index] = e.target.value;
                    // Immer eine leere Zeile am Ende: so muss nie ein
                    // Plus-Knopf gesucht werden.
                    if (index === next.length - 1 && e.target.value.trim()) {
                      next.push("");
                    }
                    return next;
                  })
                }
              />
            </div>
          ))}
        </div>
      </Group>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || filled === 0}
          className="btn btn-filled w-full sm:max-w-[320px]"
        >
          {pending ? "…" : firstRun ? "Weiter zum ersten Loop" : "Speichern"}
        </button>
        <p className="t-footnote px-4 text-[var(--label-2)]" aria-live="polite">
          {filled === 0
            ? "Mindestens ein Wert."
            : saved && !pending
              ? "Gespeichert."
              : " "}
        </p>
      </div>

      {!firstRun && (
        <p className="t-footnote px-4 text-[var(--label-3)]">
          Einen Wert zu ersetzen löscht nichts: alte Wochen behalten den Wert,
          gegen den sie bewertet wurden, und zeigen ihn weiter im Verlauf.
        </p>
      )}
    </div>
  );
}

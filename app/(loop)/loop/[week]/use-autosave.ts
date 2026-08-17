"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Pending = {
  timer: ReturnType<typeof setTimeout>;
  run: () => Promise<void>;
};

/**
 * Autosave mit Entprellung pro Feld.
 *
 * Der Loop hat keinen Speichern-Knopf, weil er auf dem Handy in der Bahn
 * abbrechbar und am Laptop fortsetzbar sein muss (PRD 01). Damit hängt die
 * Anforderung an genau dieser Stelle: was hier verloren geht, ist weg.
 *
 * Zwei Dinge, die eine naive Entprellung falsch macht:
 *
 * 1. **Pro Feld entprellen, nicht global.** Ein gemeinsamer Timer würde beim
 *    Wechsel von Slider zu Textfeld den noch offenen Slider-Schreibvorgang
 *    verwerfen.
 * 2. **Beim Schirmwechsel leeren.** Wer die letzte Zeile tippt und sofort
 *    "Weiter" drückt, hat einen offenen Timer. Ohne `flush` wäre die letzte
 *    Eingabe jedes Schirms die unzuverlässigste — also genau die, die man
 *    gerade gemacht hat.
 */
export function useAutosave() {
  const pending = useRef(new Map<string, Pending>());
  const [inFlight, setInFlight] = useState(0);
  const [failed, setFailed] = useState(false);

  const execute = useCallback(async (run: () => Promise<void>) => {
    setInFlight((n) => n + 1);
    try {
      await run();
      setFailed(false);
    } catch {
      // Sichtbar machen, nicht verschlucken. Ein still fehlgeschlagener
      // Schreibvorgang ist schlimmer als eine Fehlermeldung: der Nutzer läuft
      // weiter durch den Loop und merkt es erst beim nächsten Öffnen.
      setFailed(true);
    } finally {
      setInFlight((n) => n - 1);
    }
  }, []);

  const save = useCallback(
    (key: string, run: () => Promise<void>, delay = 600) => {
      const existing = pending.current.get(key);
      if (existing) clearTimeout(existing.timer);

      const timer = setTimeout(() => {
        pending.current.delete(key);
        void execute(run);
      }, delay);

      pending.current.set(key, { timer, run });
    },
    [execute],
  );

  /** Alle offenen Schreibvorgänge sofort ausführen und abwarten. */
  const flush = useCallback(async () => {
    const open = [...pending.current.values()];
    pending.current.clear();
    for (const entry of open) clearTimeout(entry.timer);
    await Promise.all(open.map((entry) => execute(entry.run)));
  }, [execute]);

  // Beim Verlassen der Seite offene Timer nicht einfach verfallen lassen.
  useEffect(() => {
    const map = pending.current;
    return () => {
      for (const entry of map.values()) {
        clearTimeout(entry.timer);
        void entry.run();
      }
      map.clear();
    };
  }, []);

  return { save, flush, saving: inFlight > 0, failed };
}

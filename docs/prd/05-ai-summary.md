# PRD 05 — AI-Summary der Vorwoche

**Welle 2.** Wörtlich: *»in neuer Woche AI summary kurz oben von letzter
Woche«*.

## Job to be done

> Wenn ich Sonntag den Loop öffne, weiß ich schon nicht mehr, was Montag war.
> Ich will drei Sätze, die mich wieder reinholen.

## Was es tut

Oben auf der Startseite, ab der zweiten Woche: **drei Sätze über die
Vorwoche**, aus den eigenen Antworten generiert. Nicht über die des Partners.

Aufhänger: der Score-Verlauf, die erreichten/verpassten Prios, und ein Muster,
wenn eins über mehrere Wochen sichtbar ist.

Beispiel für die Zielform:

> Letzte Woche: Lifescore 7, Arbeit deutlich unter Freizeit. Zwei von drei
> Prios erreicht — »Blog schreiben« ist die dritte Woche offen. »Weniger
> Arbeitsgedanken am Wochenende« hast du zum zweiten Mal aufgeschrieben.

Der letzte Satz ist der wertvolle: **Wiederholungen benennen.** Das ist, was
Marc mit »man merkt erst in 20 Jahren« meint, in klein.

## Regeln

- **Als Vermutung gekennzeichnet**, nie als Befund. Keine Kausalaussagen.
- **Einmal pro Woche generiert und gespeichert**, nicht bei jedem Seitenaufruf.
  Sonst kostet eine Woche zwanzig Aufrufe statt einem, und der Text ändert sich
  bei jedem Laden.
- **Fällt der Aufruf aus, fehlt die Zusammenfassung** — die Seite funktioniert
  weiter. Kein Ladebalken, der den Loop blockiert.
- **Wird nicht an den Partner ausgeliefert.** Sie beschreibt meine Woche für
  mich.
- Abschaltbar über eine Einstellung, weil sie Geld kostet.

## Warum nicht in Welle 1

Sie braucht einen LLM-Schlüssel und verursacht laufende Kosten, und der Loop
funktioniert ohne sie vollständig. Außerdem hat sie in Woche 1 und 2 nichts zu
sagen — Muster brauchen Wiederholungen. Sie wird sinnvoll ab etwa Woche vier;
bis dahin wäre sie gebaut und unbenutzt.

## Abnahme

1. Ab Woche 2 erscheinen drei Sätze, die zu den echten Antworten passen.
2. Ein wiederholter Eintrag über zwei Wochen wird als Wiederholung benannt.
3. LLM nicht erreichbar → Startseite lädt normal, ohne Fehlermeldung.
4. Zweimaliges Laden zeigt denselben Text.
5. Abgeschaltet → kein Aufruf, keine Kosten.

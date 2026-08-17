# PRD 01 — Der Wochenloop

**Welle 1.** Das Herzstück. Wenn nur das existiert, ist die App schon nützlich.

## Job to be done

> Ich will am Sonntag in fünf Minuten meine Woche abschließen und wissen, was
> nächste Woche zählt — ohne eine Seite anzulegen, ohne nachzudenken, wo ich
> anfange.

## Die Woche als Einheit

Eine Woche ist ein ISO-Wochenschlüssel: `2026-W34`. Sie läuft **Montag 00:00
bis Sonntag 23:59 Europe/Berlin**. Die Zeitzone ist nicht optional — ohne
gesetztes `TZ` läuft der Container in UTC und ordnet Sonntagabend-Einträge der
falschen Woche zu.

Die Woche wird **nie manuell angelegt**. Wer die App öffnet, ist in der
aktuellen Woche. Das ist die direkte Antwort auf »Notion öffnen, Wochenseite
erstellen ist zu viel Friction«.

Eine vergangene Woche bleibt nachträglich füllbar. Der Streak reißt trotzdem —
die Nachsicht gilt für die Daten, nicht für die Statistik.

## Die zwei Längen

| | Minimum | Voll |
| - | ------- | ---- |
| Schirme | 8 | 14 |
| Zielzeit | 2 min | 5 min |
| Wofür | Urlaub, Krankheit, Alltag kommt dazwischen | der Normalfall |

Die Wahl passiert **auf der Startseite**, nicht im Loop — zwei Knöpfe, damit
der Klick auf »Voll« nicht durch eine Zwischenfrage verzögert wird.

Wechseln ist erlaubt: wer minimal startet und Lust bekommt, kann am Ende auf
»noch die restlichen Fragen« gehen. Die Antworten bleiben, es kommen nur
Schirme dazu. Umgekehrt löscht ein Wechsel nach unten **nichts** — bereits
gegebene Antworten werden nur nicht mehr abgefragt.

## Die Schirme

`★` = auch in der Minimum-Version. Vollständige Herleitung der Reihenfolge in
`../notes/06-fragebogen.md`.

| # | Schirm | Eingabe | ★ |
| - | ------ | ------- | - |
| 0 | Ankommen: »KW 34. Das waren deine Prios.« | nur Anzeige, kein Klick nötig zum Lesen | ★ |
| 1 | Wie zufrieden bist du mit deiner Woche? | Slider 1–10 | ★ |
| 2 | Und nach Bereich? | 3 Slider 1–10: Arbeit, Freizeit, Selbst | |
| 3 | Hast du deine Werte gelebt? | pro Wert Slider 1–5 | ★ |
| 4 | Deine 3 Prios — erreicht? | pro Prio: erreicht / teilweise / nicht | ★ |
| 5 | Warum die Lücke? | Text, **nur** wenn ≥1 Prio nicht »erreicht« | |
| 6 | Was ist dir gelungen? | Liste | ★ |
| 7 | Was war schwierig? | Liste | |
| 8 | Was hat sich unnötig angefühlt? | Liste | |
| — | **Teil 1 abgegeben** — Partner wird freigeschaltet | Übergang | ★ |
| 9 | Wer willst du nächste Woche sein? Ein Wort. | Text, kurz | ★ |
| 10 | Wie sieht eine gute nächste Woche aus? | Text | |
| 11 | Deine 3 Prios | 3 Felder, hart limitiert | ★ |
| 12 | Was machst du diesmal anders? | Text | |
| 13 | Das war die Woche deines Partners | nur Anzeige | ★ |
| 14 | Wenn das meine Woche gewesen wäre… | Text an den Partner | ★ |

Schirm 5 ist **bedingt**: er erscheint nur, wenn Schirm 4 eine Lücke ergeben
hat. Eine Woche, in der alles erreicht wurde, soll nicht nach einer Ausrede
fragen.

Schirm 0 zeigt die Prios der Vorwoche, bevor irgendwas bewertet wird. Das ist
After-Action-Review-Frage 1 (»was sollte passieren«) und kostet null Eingabe.

## Interaktion

**Eine Frage pro Schirm.** Kein Scrollen innerhalb eines Schirms auf dem Handy.
Wenn eine Frage nicht auf ein iPhone-Display passt, ist sie zu groß und wird
geteilt.

**Progressbar oben**, dünn, mit Schirm-Zähler. Sie ist die Antwort auf »wie
lange noch« — die Frage, die Abbrüche verursacht.

**Vor und zurück.** Zurück verliert nichts.

**Autosave bei jeder Änderung.** Kein »Speichern«-Knopf. Der Loop muss auf dem
Handy in der Bahn abbrechbar und am Laptop fortsetzbar sein — das ist eine
Anforderung, nicht ein Komfort.

**Überspringen ist erlaubt**, außer bei Schirm 11 (Prios). Ohne Prios gibt es
nächste Woche nichts zu bewerten und der Loop verliert seinen Sinn. Mindestens
eine Prio ist Pflicht, drei sind das Maximum.

**Slider starten in der Mitte und ungesetzt.** Ein Slider, der bei 5 vorbelegt
ist, wird als Antwort gezählt, obwohl niemand ihn angefasst hat. Sichtbar
ungesetzt, bis er berührt wird.

## Der Zustand eines Eintrags

```
leer → entwurf → teil1_abgegeben → abgegeben
```

| Zustand | Bedeutung | Löst aus |
| ------- | --------- | -------- |
| `entwurf` | angefangen, Teil 1 unvollständig | nichts |
| `teil1_abgegeben` | Rückblick steht | Partner darf meinen Teil 1 sehen |
| `abgegeben` | alles durch | wenn beide: alles gegenseitig sichtbar |

Der Übergang zu `teil1_abgegeben` passiert am Ende von Schirm 8 mit einem
ausdrücklichen Knopf. Er ist die einzige Stelle mit einer Bestätigung, weil er
etwas für den anderen sichtbar macht und **nicht zurückgenommen** werden kann.
Danach bleiben die Antworten aus Teil 1 editierbar — was der Partner sieht,
ändert sich mit; heimlich Umschreiben nach der Freigabe gibt es nicht, aber
Tippfehler korrigieren muss möglich bleiben.

## Listen-Eingabe

Erfolge, Challenges und Weglassen sind Listen. Enter fügt eine Zeile hinzu,
leere Zeilen verschwinden beim Verlassen des Schirms. Kein Limit außer bei den
Prios.

## Grenzen

| Feld | Grenze | Warum |
| ---- | ------ | ----- |
| Prios | max. 3, min. 1 | »Ich nehme mir zu viel vor« ist ein genanntes Problem |
| Identität | 40 Zeichen | »Ein Wort der Woche«, kein Absatz |
| Textfelder | 2000 Zeichen | verhindert Missbrauch, nicht Ausdruck |
| Listeneinträge | 200 Zeichen | eine Zeile, kein Aufsatz |

Die Prio-Grenze ist Produkt, nicht Technik. Sie darf nicht »später
konfigurierbar« werden.

## Abnahme

1. Startseite → erste Frage in **einem** Klick.
2. Vollversion in unter 5 Minuten füllbar, Minimum in unter 2 (mit der Uhr
   gemessen, nicht geschätzt).
3. Loop auf dem Handy nach Schirm 6 verlassen, am Laptop fortsetzen: alle
   Antworten da.
4. Schirm 5 erscheint nur bei einer Lücke in Schirm 4.
5. Vierte Prio eingeben ist unmöglich, nicht nur unerwünscht.
6. Unberührter Slider zählt als »keine Antwort«, nicht als 5.
7. Woche wird ohne Handgriff angelegt; `TZ=Europe/Berlin` verifiziert, indem
   ein Eintrag Sonntag 23:30 der richtigen Woche zufällt.

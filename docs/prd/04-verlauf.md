# PRD 04 — Verlauf und Streak

**Welle 1**, absichtlich minimal. Wörtlich: *»Overview über Zeit → 3 values«*,
*»minimale Analytics«*, *»Streak aufbauen«*.

## Job to be done

> Ich will nach zehn Wochen sehen, ob es aufwärts geht — ohne eine
> Analytics-Oberfläche bedienen zu müssen.

Und der eigentliche Grund, Marcs Satz: *»man merkt erst in 20 Jahren, wenn man
schlechte Gewohnheiten hatte.«* Der Verlauf ist der Frühwarnmelder.

## Was gezeigt wird — und nur das

### 1. Lifescore über Zeit

Eine Linie pro Person, Wochen auf der X-Achse. Beide Personen im selben
Diagramm, sobald beide abgegeben haben — das ist der »zwei Spalten«-Gedanke des
Templates als Kurve.

### 2. Die drei Bereiche

Arbeit · Freizeit · Selbst, drei Linien, nur die eigenen. Beantwortet die Frage,
die der Lifescore allein nicht beantwortet: **wo** die 7 herkommt.

### 3. Die drei Werte

Drei Linien, 1–5. Die »3 values over time« aus Chris' Notiz.

### 4. Prio-Trefferquote

Der wichtigste Wert und der einzige, der eine Verhaltensänderung auslöst:

```
Letzte 8 Wochen: 11 von 24 Prios erreicht (46 %)
```

Wer über Monate bei 40 % liegt, nimmt sich zu viel vor — genau Chris' Problem
Nummer drei. Die Zahl macht es unbestreitbar, und sie ist der Grund, warum
Schirm 4 des Loops jede Prio einzeln bewerten lässt statt pauschal.

### 5. Streak

```
🔥 6 Wochen in Folge
```

Zusammenhängende Wochen mit Zustand `abgegeben`. Bricht bei einer Lücke.
Nachträglich gefüllte Wochen zählen für die Daten, **nicht** für den Streak —
sonst ist es keine Aussage über Gewohnheit mehr.

Der Streak steht auf der Startseite, nicht nur im Verlauf. Er ist der einzige
Zahlenwert, der ohne Klick sichtbar ist.

## Was es nicht gibt

**Keine Korrelationen.** Kein »dein Lifescore ist hoch, wenn du Sport machst«.
Bei zwei Nutzern und 20 Wochen ist jede Korrelation Rauschen, und sie klingt
klug, während sie falsch ist. Insights sind Welle 2 und werden dann
LLM-generiert und als Vermutung gekennzeichnet, nicht als Statistik.

**Keine Durchschnitte über Personen.** Marcs 8 und Chris' 6 zu einer 7 zu
verrechnen bedeutet nichts.

**Keine Wochen-Vergleiche in Prozent.** »+12 % zur Vorwoche« bei einer
Selbstauskunft von 1–10 ist Scheingenauigkeit.

**Kein Export.** Später eventuell; bis dahin ist das Backup die Antwort auf
»wo sind meine Daten«.

## Die Zeitfenster

Umschaltbar: **8 Wochen** (Standard) · **26 Wochen** · **alles**. Acht, weil das
das Erfolgskriterium der App ist und weil eine Kurve mit vier Punkten nichts
zeigt.

## Leere Zustände

Der Verlauf ist in Woche 1 komplett leer, und das ist der Normalfall der ersten
zwei Monate. Deshalb muss er in leer gut aussehen:

| Datenlage | Anzeige |
| --------- | ------- |
| 0 Wochen | »Nach deinem ersten Loop entsteht hier eine Kurve.« Kein leeres Diagrammgerüst. |
| 1 Woche | Die Zahlen als Werte, kein Diagramm. Eine Linie mit einem Punkt ist eine Lüge. |
| ab 2 Wochen | Diagramme. |
| Prio-Quote | erst ab 2 abgegebenen Wochen — vorher gibt es keine bewerteten Prios. |

## Abnahme

1. Zwei gefüllte Wochen ergeben eine Kurve mit zwei Punkten.
2. Eine gefüllte Woche zeigt Zahlen, kein Diagramm.
3. Prio-Quote stimmt mit den Rohdaten überein (per Hand nachgezählt).
4. Streak: drei Wochen in Folge = 3; Lücke in der Mitte = ab der Lücke neu
   gezählt.
5. Nachträglich gefüllte Woche erhöht die Datenpunkte, nicht den Streak.
6. Verlauf ist ohne Daten aufrufbar, ohne Fehler und ohne leeres Gerüst.

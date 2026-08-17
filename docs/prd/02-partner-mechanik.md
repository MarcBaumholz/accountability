# PRD 02 — Partner-Mechanik

**Welle 1.** Das ist der Teil, der die App von einem Tagebuch unterscheidet.

## Job to be done

> Ich will, dass jemand merkt, wenn ich nicht liefere — und ich will von seiner
> Woche etwas mitnehmen, ohne dass wir dafür telefonieren müssen.

## Das Grundproblem, das die Freigabe-Stufen lösen

Wenn beide alles sofort sehen, passiert zweierlei Schlechtes: man **richtet die
eigenen Antworten an denen des anderen aus** (Anchoring), und die Empfehlung an
den anderen wird zur Höflichkeitsfloskel, weil man seine Prios schon kennt.

Wörtlich aus den Notizen: *»du bekommst den ersten Teil des anderen«* und *»man
sieht nicht, was der andere ausfüllt für Teil 2«*.

Deshalb drei Stufen:

| Stufe | Auslöser | Was ich sehe |
| ----- | -------- | ------------ |
| 1 | ich habe **noch nichts** abgegeben | nur *ob* der Partner angefangen/abgegeben hat — kein Inhalt |
| 2 | **ich** habe Teil 1 abgegeben | Teil 1 des Partners: Scores, Werte, Prio-Auswertung, Erfolge, Challenges, Weglassen |
| 3 | **beide** haben abgegeben | alles: Identität, Vision, Prios, AAR-Antwort, und die Empfehlung des anderen an mich |

Stufe 2 hängt an **meiner** Abgabe, nicht an seiner. Wer zuerst fertig ist, hat
sofort etwas zu lesen (falls der andere schon abgegeben hat) — wer zögert, sieht
nichts. Das ist die Peer-Pressure-Mechanik, und sie ist absichtlich asymmetrisch
zu meinen Gunsten, wenn ich schnell bin.

## Peer Pressure, konkret

Auf der Startseite, immer sichtbar, ohne Inhalt zu verraten:

```
Chris   ● Teil 1 abgegeben · Do 21:40
Du      ○ noch nicht angefangen
```

Drei Zustände pro Person: `noch nicht` · `dran` (Entwurf existiert) ·
`abgegeben`. Plus Zeitstempel. Kein Inhalt, kein Score — nur der Status.

Das ist die ganze Konsequenz, die es braucht. Chris' Notiz war: »alleine kann
ich den Termin ohne Konsequenzen verschieben«. Die Konsequenz ist, dass es
jemand sieht.

## Die Empfehlung (Schirm 14)

Wörtlich: *»Empfehlung aussprechen für den anderen«*, *»wenn das meine letzte
Woche wäre, hätte ich das gemacht«*, und als benannte Lücke: *»challenge fehlt
— wie können wir uns einfacher challengen«*.

Der Schirm zeigt links Teil 1 des Partners, rechts ein Textfeld mit dem
Satzanfang als Platzhalter: **»Wenn das meine Woche gewesen wäre, hätte ich…«**

Der Satzanfang ist nicht Deko. Er verschiebt die Aussage von »du solltest« zu
»ich hätte« — das ist der Unterschied zwischen einem Ratschlag, der ankommt,
und einem, der abprallt.

Die Empfehlung wird dem anderen erst in **Stufe 3** gezeigt, mit seiner
Empfehlung an mich daneben. Beide gleichzeitig, keiner zuerst.

## Was es nicht gibt

**Keine Kommentar-Threads, kein Chat.** Eine Empfehlung pro Person pro Woche.
Wer mehr sagen will, ruft an — dafür ist der Call da. Ein Nachrichten-Feature
wäre die zweite App im ersten Bauch.

**Keine Bewertung des anderen.** Kein Daumen, kein Score für seine Woche. Die
Notiz »wir nehmen es hin, was der andere sagt« beschreibt das Problem, nicht
das Ziel — aber die Lösung ist die »ich hätte«-Formulierung, nicht eine
Benotung.

**Keine Erinnerung an den anderen.** Kein »stups Chris an«-Knopf. Das ist
Welle 3 und braucht erst Benachrichtigungen; bis dahin ist der sichtbare Status
auf der Startseite die einzige Aufforderung.

## Grenzfälle

| Fall | Verhalten |
| ---- | --------- |
| Chris füllt gar nicht | Marc kann vollständig durchlaufen. Schirm 13/14 sagt »Chris hat diese Woche nichts abgegeben« und wird übersprungen. Der Loop hängt **nie** am anderen. |
| Chris füllt drei Wochen später nach | Stufe 3 wird dann erreicht. Marc bekommt es beim nächsten Öffnen zu sehen. |
| Beide gleichzeitig aktiv | Kein Problem — jeder schreibt nur seinen eigenen Eintrag. |
| Chris ändert Teil 1 nach der Freigabe | Marc sieht die neue Version. Keine Historie, kein Diff. |

Der wichtigste davon ist der erste: **die App darf nie blockieren, weil der
Partner nicht liefert.** Sonst hängt Marcs Gewohnheit an Chris' Disziplin und
das Problem ist verdoppelt statt gelöst.

## Abnahme

1. Vor eigener Abgabe: kein Inhalt des Partners sichtbar, auch nicht über die
   URL eines Detail-Endpunkts. Serverseitig geprüft, nicht nur ausgeblendet.
2. Nach eigener Teil-1-Abgabe: Teil 1 des Partners sichtbar, dessen Prios
   **nicht**.
3. Nach beidseitiger Abgabe: alles sichtbar, beide Empfehlungen gleichzeitig.
4. Partner füllt nichts: eigener Loop vollständig durchlaufbar.
5. Status auf der Startseite stimmt mit der Datenbank überein.

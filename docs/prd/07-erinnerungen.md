# PRD 07 — Erinnerungen und Termin

**Welle 3.** Wörtlich: *»asynchron Benachrichtigung → immer
Benachrichtigung«*, *»Kalender integrieren → 1 Klick Alternativtermine → an den
anderen senden per Google-Einladung«*.

## Job to be done

> Ich will nicht daran denken müssen, dass Sonntag ist. Und wenn wir den Termin
> verschieben, will ich nicht drei Nachrichten dafür brauchen.

## Teil A — Benachrichtigungen

Web Push (VAPID), drei Auslöser und keiner mehr:

| Auslöser | Text | Wann |
| -------- | ---- | ---- |
| Loop offen | »KW 34 ist offen. 5 Minuten.« | Sonntag 10:00 |
| Partner hat abgegeben | »Chris hat abgegeben.« | sofort |
| Letzte Chance | »Noch nicht gefüllt — der Streak steht bei 6.« | Sonntag 20:00, nur wenn offen |

Die dritte ist die einzige mit Druck, und sie nennt den Streak, weil das der
Wert ist, den man nicht verlieren will.

**Keine täglichen Erinnerungen.** Die App ist wöchentlich; täglich zu erinnern
macht sie zu einem Tracker, was ausdrücklich nicht gewollt ist (»möchte auch
nicht immer tracken«).

Push auf iOS funktioniert nur in der **installierten** PWA. Wer nicht
installiert hat, bekommt nichts — das muss in der Einstellung stehen, sonst ist
es ein stiller Fehlschlag.

## Teil B — Termin

Ein fester Wochentermin für den Call, als Kalender-Datei. Zwei Ausbaustufen:

**Stufe 1 (klein, ohne OAuth):** die App erzeugt eine `.ics`-Datei für einen
wiederkehrenden Termin. Beide importieren sie einmal. Das ist mit einem
Bruchteil des Aufwands 80 % des Nutzens — und es ist Chris' »fester Termin«,
mehr braucht es zunächst nicht.

**Stufe 2 (Google OAuth):** Alternativtermine vorschlagen und dem anderen als
Einladung senden. Braucht Google-OAuth, Kalender-Scope, Token-Erneuerung — für
zwei Leute, die auch »verschieben wir auf Montag« schreiben könnten.

→ Empfehlung: Stufe 1 bauen, Stufe 2 erst, wenn das Verschieben in der Praxis
wirklich nervt. Wörtlich war der Wunsch »1 Klick Alternativtermine«; der ehrliche
Hinweis dazu ist, dass ein Klick hier ein OAuth-Flow, ein Token-Store und ein
Fehlerpfad ist.

## Teil C — Live-View im Call

Aus den Notizen: *»im Call → live view des anderen«*.

Während beide gleichzeitig ausfüllen, sieht man den anderen live schreiben.
Braucht Polling oder SSE, und es untergräbt die Freigabe-Stufen aus PRD 02 —
der ganze Sinn der Stufen ist, dass man sich nicht aneinander ausrichtet.

→ Deshalb: **nur für Teil 1**, und nur wenn beide den Call-Modus aktiv
einschalten. Nicht als Standard. Und ehrlich gesagt der Kandidat, der am
ehesten gestrichen wird — ein geteilter Bildschirm im Call tut dasselbe ohne
eine Zeile Code.

## Abnahme

1. Push kommt an, auf dem installierten iPhone.
2. Keine Benachrichtigung, wenn schon abgegeben.
3. Nicht installiert → Einstellung sagt das deutlich.
4. `.ics` importiert sauber in Google Calendar und Apple Kalender.

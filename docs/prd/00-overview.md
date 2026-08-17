# PRD 00 — Überblick und Schnitt

**Produkt:** Accountability — ein wöchentlicher Review-Loop für zwei Partner.
**Nutzer:** Marc und Chris. Genau zwei. Kein Multi-Tenant, keine Registrierung.
**Adresse:** `accountability.marcbaumholz.de`
**Stack:** Next.js 16 · SQLite/Drizzle · Docker auf dem Raspberry Pi hinter
Cloudflare Tunnel + Access. Derselbe Weg wie LifeOS, weil er auf dieser
Hardware bereits bewiesen ist.

## Der eine Satz

> Zwei Leute schreiben jede Woche in fünf Minuten auf, wie die Woche war und
> was nächste Woche zählt — und sehen einander dabei zu, damit keiner allein
> abbricht.

## Warum es das gibt

Fünf Ursachen, ausführlich in `../notes/03-problem.md`: alleine bricht die
Routine; Notion hat zu viel Friction; man nimmt sich zu viel vor; es fehlt
Struktur; und Fehlentwicklungen fallen erst nach Jahren auf.

Die App ist erfolgreich, wenn Marc und Chris **acht Wochen hintereinander**
gefüllt haben. Nicht, wenn sie viele Features hat.

## Der Schnitt in Wellen

Das Wichtige zuerst, und die Regel für den Schnitt ist hart: **Welle 1 ist
alles, was der Loop braucht, um allein zu funktionieren.** Alles, was nur
angenehmer macht, was ohne es auch geht, wartet.

### Welle 1 — der Loop steht

| PRD | Inhalt |
| --- | ------ |
| `01-wochenloop.md` | Der Fragebogen, beide Längen, Zwischenspeichern |
| `02-partner-mechanik.md` | Freigabe-Stufen, Partner-Empfehlung, Peer Pressure |
| `03-fundament.md` | Werte und Ziele, einmal gesetzt, wöchentlich abgefragt |
| `04-verlauf.md` | Score-Verlauf, Prio-Trefferquote, Streak |
| `08-plattform.md` | Auth über Access, PWA, Pi-Deployment, Backup |

Danach ist die App benutzbar und ersetzt das Notion-Template vollständig.

### Welle 2 — es wird klüger

| PRD | Inhalt | Wartet, weil |
| --- | ------ | ------------ |
| `05-ai-summary.md` | Kurze Zusammenfassung der Vorwoche oben auf der Startseite | braucht LLM-Schlüssel und laufende Kosten |
| `06-coach-fragen.md` | Coach-Rolle: dem anderen gute Fragen stellen | braucht erst Daten aus echten Wochen |
| — | Goal Setting / OKR-Richtung, Hindernis-Vorhersage | erst sinnvoll, wenn das Fundament steht |

### Welle 3 — es erinnert und verbindet

| PRD | Inhalt | Wartet, weil |
| --- | ------ | ------------ |
| `07-erinnerungen.md` | Web-Push-Benachrichtigungen | braucht VAPID-Schlüssel und iOS-Install |
| — | Kalender-Integration, Google-Einladung | braucht Google OAuth |
| — | Live-View im Call | nur sinnvoll, wenn wir wirklich regelmäßig callen |

## Was das Produkt ausdrücklich nicht ist

- **Keine To-do-App.** »Es ist keine Wochenplanung einkaufen gehen.«
- **Kein Tracker.** Erfassung einmal pro Woche, nicht täglich.
- **Kein Journal.** Der Loop ist strukturiert und kurz, nicht offen und lang.
- **Nicht für Dritte.** Zwei Nutzer, fest verdrahtet. Wenn ein Dritter dazu
  soll, ist das eine Änderung am Datenmodell und keine Einstellung.

## Wie »fertig« aussieht

Welle 1 gilt als fertig, wenn folgendes von außen nachweisbar ist:

1. `https://accountability.marcbaumholz.de` antwortet mit `302` zu Cloudflare
   Access, und nach Login mit der Startseite.
2. Von der Startseite ist die erste Frage **ein Klick** entfernt.
3. Ein vollständiger Loop ist in unter fünf Minuten füllbar, die
   Minimum-Version in unter zwei.
4. Der Loop lässt sich mitten drin verlassen und auf einem anderen Gerät
   fortsetzen.
5. Chris sieht Marcs Teil 1 erst, nachdem er seinen eigenen Teil 1 abgegeben
   hat — und Marcs Prios erst, wenn beide fertig sind.
6. Der Verlauf zeigt mindestens zwei Wochen Scores als Kurve.
7. Ein nächtliches Backup läuft, und ein Restore wurde **einmal wirklich
   durchgeführt** und die Zeilen gezählt.

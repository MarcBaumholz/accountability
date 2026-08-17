# PRD 08 — Plattform, Auth, Deployment

**Welle 1.** Wörtlich: *»app? Handy oder Desktop → überall Access«*.

## Stack und warum

| Baustein | Wahl | Warum diese |
| -------- | ---- | ----------- |
| Framework | Next.js 16, App Router, Server Actions | LifeOS läuft damit auf genau diesem Pi. Ein zweiter Stack wäre ein zweiter Satz Fehlerquellen. |
| Datenbank | SQLite + Drizzle | Zwei Nutzer, ein paar Tausend Zeilen im Jahr. Postgres wäre ein Container mehr auf einer Karte mit 5 GB frei. |
| Styling | Tailwind 4 | wie LifeOS |
| Icons | Phosphor | wie LifeOS |
| PWA | Serwist | wie LifeOS, inkl. der Access-Redirect-Falle |
| Host | Docker auf dem Pi, `127.0.0.1:8100` | `8088–8099` ist voll bis auf `8096`; die Port-Karte sagt, der nächste ist `8100` |
| Zugang | Cloudflare Tunnel + Access | wie alle anderen Apps auf dem Pi |

## Auth: die Identität kommt von Cloudflare Access

Kein eigener Login, kein Passwort, keine Session-Tabelle.

Access setzt bei jeder Anfrage den Header
`Cf-Access-Authenticated-User-Email`. Der Container hört **nur** auf
`127.0.0.1:8100`, und nur `cloudflared` erreicht ihn — der Header kann also von
außen nicht gefälscht werden, weil von außen niemand direkt an den Port kommt.

Daraus folgen zwei harte Regeln:

1. **Eine E-Mail-Allowlist im Code**, nicht nur die Access-Policy. Zwei
   Adressen, alles andere ist `403`. Access ist die erste Tür, die Allowlist die
   zweite — falls eine Access-Policy je versehentlich offen steht (auf diesem Pi
   schon dreimal passiert, siehe Port-Karte).
2. **Fehlender Header = `403`, niemals ein Fallback-Nutzer.** In Produktion. Nur
   wenn `NODE_ENV !== "production"` **und** `DEV_USER_EMAIL` gesetzt ist, gilt
   diese Adresse — das ist der lokale Entwicklungspfad.

Bewusster Nachteil: wer Access umgeht (z. B. jemand mit SSH auf dem Pi), ist
ohne weitere Hürde drin. Bei zwei Nutzern auf privater Hardware ist das
akzeptiert. Es steht hier, damit es eine Entscheidung ist und keine Lücke.

## PWA — die zwei Access-Fallen

Beide werden **im Code** gelöst, nicht mit Bypass-Regeln in der Dashboard-Policy
(Details in `pi-deploy/references/access-and-pwa.md`):

1. **Manifest und Service Worker liegen hinter Access.** Der Service Worker wird
   über eine App-Route ausgeliefert, damit er dieselbe Session mitbringt.
2. **Eine abgelaufene Access-Session antwortet mit einem Redirect auf die
   Login-Seite** — und der Service Worker cached diese Antwort. Danach zeigt die
   installierte App dauerhaft eine Login-Seite, auch nach erneutem Login. Der
   Service Worker muss **weitergeleitete Antworten verwerfen** statt sie zu
   cachen. Dieser Fix ist in LifeOS bereits geschrieben und wird übernommen.

Offline-Anspruch bleibt klein: die App-Hülle und die letzten Verlaufsdaten sind
offline lesbar; **Schreiben offline gibt es nicht.** Ein Loop mit
Konfliktauflösung zwischen zwei Geräten wäre mehr Aufwand als der ganze Rest,
und niemand füllt seinen Wochenrückblick im Flugmodus.

## Deployment

Der Weg aus dem `/pi-deploy`-Skill, unverändert:

```
Browser → Cloudflare (TLS, Access) → cloudflared → 127.0.0.1:8100 → Container → ./data
```

Vier Punkte, die dort jeweils einen echten Deploy gekostet haben und hier
gelten:

- `.env*` aus dem rsync **und** aus dem Docker-Build ausschließen.
- Das Datenverzeichnis **vor** `docker compose up` als uid 1000 anlegen, sonst
  `SQLITE_CANTOPEN`.
- Auf `/healthz` warten, nicht auf den Rückgabewert von `compose`.
- `/etc/cloudflared/config.yml` auf dem Pi ist tot — die Route wird im
  Cloudflare-Dashboard angelegt und im Journal des Tunnels verifiziert.

DNS und Tunnel-Route sind Dashboard-Arbeit und werden als Anleitung übergeben,
nicht von der App erledigt.

## Backup

Nach dem Muster von `habitloop` und LifeOS: systemd-`oneshot` + Timer, nachts,
`Persistent=true`.

Für SQLite nicht verhandelbar: **`sqlite3 .backup`, nicht `cp`.** Mit
WAL-Journal stehen die letzten Schreibvorgänge in `-wal`; bei LifeOS war die
`.db` 4 KB und das WAL 288 KB. Ein `cp` hätte eine formal fehlerfreie, leere
Datenbank gesichert. Danach `PRAGMA integrity_check` **und Zeilen zählen** —
letzteres ist die Prüfung, die den leeren Erfolgsfall auffliegen lässt.

Und die Einschränkung ausgesprochen: der Pi hat **keine externe Platte**. Ein
Pi-lokales Backup schützt gegen Fehler und Versehen, **nicht** gegen den Tod der
SD-Karte. Deshalb zusätzlich ein Skript, das eine Kopie auf den Mac zieht — das
ist die einzige Kopie, die den Kartentod überlebt.

## Nicht-Ziele

- Kein Multi-User über die zwei hinaus.
- Keine Registrierung, kein Passwort-Reset, keine E-Mails.
- Kein Offline-Schreiben.
- Kein CI/CD. Deploy ist ein Skript, das Marc ausführt.

## Bekannte Abweichung: der Status-Code bei Abweisung

Die Kriterien 3 und 4 unten forderten ursprünglich **`403`**. Geliefert wird die
Seite »Kein Zugang« mit **`200`**. Das ist eine bewusste Abweichung, nicht ein
offener Punkt:

Ein Next-Layout kann keinen Status-Code setzen. Für ein echtes `403` gäbe es zwei
Wege, und beide kosten mehr, als der Status wert ist: `forbidden()` braucht das
**experimentelle** Flag `authInterrupts`, und eine `middleware.ts` mit
Datenbankzugriff würde die Prüfung verdoppeln und die Node-Runtime in der
Middleware verlangen.

**Was der Status nicht ändert:** es wird kein Inhalt ausgeliefert, weder der
eigene noch der des Partners. Die Abweisung ist wirksam, sie ist nur nicht
maschinenlesbar codiert. Bei zwei Nutzern ohne Monitoring und ohne API-Clients
gibt es niemanden, der den Code auswertet.

**Wann das zu ändern wäre:** sobald es Alarmierung auf HTTP-Fehler gibt, oder
sobald ein Client die App nicht als HTML konsumiert. Dann `authInterrupts` +
`forbidden()`, sobald es stabil ist.

## Abnahme

1. `curl -sI https://accountability.marcbaumholz.de` → `302` zu
   `cloudflareaccess.com`.
2. Nach Login: Startseite, als der richtige Nutzer erkannt.
3. Dritte E-Mail-Adresse (in Access erlaubt, nicht in der Allowlist) → Seite
   »Kein Zugang«, **kein Inhalt**, Eintrag im Container-Log. Status `200`, siehe
   die Abweichung oben.
4. Ohne Header direkt am Port → dasselbe.
4a. Vom LAN aus ist der Port **nicht erreichbar** (`nc -vz <pi> 8100` schlägt
   fehl). Das ist die Bedingung, unter der die Header-Identität überhaupt
   tragfähig ist, und damit das wichtigere Kriterium als der Status-Code.
5. Auf dem iPhone installierbar, Icon auf dem Homescreen.
6. Access-Session ablaufen lassen, neu einloggen → **keine** eingefrorene
   Login-Seite in der installierten App.
7. Backup läuft, `integrity_check` grün, Zeilen gezählt, **einmal in ein
   Wegwerf-Verzeichnis restauriert** und dort nachgezählt.
8. `docker compose down && up` verliert keine Daten.

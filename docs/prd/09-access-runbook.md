# PRD 09 — Runbook: Cloudflare Access einrichten und prüfen

Handarbeit im Dashboard, einmal. Diese Datei ist die Anleitung dazu und die
Prüfliste danach — sie deckt die Abnahmepunkte 1–4 und 6 aus
`08-plattform.md` ab.

Die Logik dahinter steht in `08-plattform.md` § »Auth: die Identität kommt von
Cloudflare Access«: **Access ist die erste Tür, die `person`-Tabelle die
zweite.** Beide müssen einzeln geprüft werden, sonst prüft man nur, dass
irgendeine von beiden hält.

> Dashboard-Beschriftungen bei Cloudflare wandern. Die Landmarken hier
> (Reihenfolge der Menüs, Feldbedeutung) sind stabil, die exakten Wörter nicht.
> Wenn ein Label anders heißt, ist es das, das im Text an derselben Stelle
> steht — nicht ein anderes Menü.

---

## 0 — Voraussetzung: die Tunnel-Route

Erst die Route, dann Access. Ohne Route zeigt Access auf nichts und man
debuggt zwei Dinge gleichzeitig.

1. Zero-Trust-Dashboard (`one.dash.cloudflare.com`) → **Networks → Tunnels** →
   den Tunnel des Pi öffnen → **Published application routes** (früher »Public
   Hostnames«) → **Add**.
2. Subdomain `accountability`, Domain `marcbaumholz.de`, Path leer.
3. Service: **HTTP**, URL `127.0.0.1:8100`.
4. Speichern und **im Journal des Tunnels** nachsehen, nicht im Dashboard:

   ```bash
   ssh pi 'sudo journalctl -u cloudflared -n 30 --no-pager'
   ```

   Erwartet: eine Zeile mit `Updated to new configuration` und der neuen
   Hostname-Zuordnung. `/etc/cloudflared/config.yml` auf dem Pi ist tot — die
   Konfiguration kommt aus dem Dashboard, und Änderungen an der Datei tun
   nichts.

Der DNS-Eintrag (`CNAME` auf `<tunnel-id>.cfargotunnel.com`) wird dabei
automatisch angelegt.

---

## 1 — Die Access-Anwendung anlegen

1. **Access → Applications → Add an application → Self-hosted.**
2. **Application name:** `Accountability`.
3. **Session Duration:** `1 month`.
   Nicht Geschmack, sondern die PWA (siehe § 5): der Standard von 24 Stunden
   bedeutet, dass die installierte App auf dem Handy **jeden Tag** einen
   Login-Umweg macht. Bewusst gekaufter Nachteil: ein entsperrtes, gestohlenes
   Handy bleibt einen Monat angemeldet. Akzeptiert, weil das Handy seine eigene
   Sperre hat und in der App nur Wochenrückblicke stehen.
4. **Public hostname:** Subdomain `accountability`, Domain `marcbaumholz.de`,
   **Path leer.** Ein Path würde nur einen Teil der App schützen, und der Rest
   wäre offen.
5. **Identity providers:** die vorhandenen anlassen, **One-time PIN
   eingeschaltet lassen**. Der PIN-Weg funktioniert auch dort, wo ein
   Google-Login im PWA-Fenster hängen bleibt (§ 5).
6. Weiter zum Policy-Schritt — **nicht** vorher speichern und »das mache ich
   gleich«: genau daraus entsteht die Falle in § 2.

## Die Policy für zwei Adressen

Im Policy-Schritt der Anwendung (oder unter **Access → Policies**, dann in der
Anwendung auswählen):

| Feld | Wert |
| --- | --- |
| Policy name | `Accountability — Marc und Chris` |
| Action | **Allow** |
| Session duration | *same as application* |
| Include → Selector | **Emails** |
| Include → Value | die zwei Adressen, je eine Zeile |

Drei Dinge, die hier falsch laufen können:

- **`Emails ending in @…` statt `Emails`.** Damit kommt jede Adresse der Domain
  herein. Bei einer Gmail-Adresse wäre das die halbe Welt.
- **Zwei Allow-Policies statt einer mit zwei Adressen.** Funktioniert, macht
  aber die Liste unlesbar — auf diesem Konto liegen bereits vier Duplikate von
  »Only Marc«. Eine Policy, zwei Einträge.
- **Die Adressen weichen von `ACC_PEOPLE` ab.** Dann ist die zweite Tür zu,
  während die erste offen ist: der Nutzer sieht »Kein Zugang« und niemand weiß,
  warum. Die beiden Listen sind **wörtlich dieselben zwei Adressen**, und wer
  den Partner wechselt, ändert beide (`.env` auf dem Pi **und** die Policy).

Speichern.

---

## 2 — Die Falle: eine Anwendung ohne Policy ist offen

**Eine neu erstellte Access-Anwendung zeigt in der Spalte »Policies« `--` und
ist dann für jeden im Internet erreichbar.** Cloudflare warnt nicht davor. Auf
diesem Pi ist das dreimal passiert; `n8n.marcbaumholz.de`,
`vision.marcbaumholz.de` und `healthyproductivity.de` antworten heute noch
**200 ohne jeden Login**.

Deshalb nach dem Speichern **immer**: zurück in die Liste **Access →
Applications** und in der Zeile `Accountability` nachsehen, dass in der
Policy-Spalte der Name der Policy steht und nicht `--`.

Das Dashboard ist dabei nur die halbe Prüfung. Der Beweis kommt von außen (§ 3).

---

## 3 — Prüfen von außen (Abnahme 1)

Von einem Rechner **außerhalb** — nicht vom Pi, dort greift Access nicht.

```bash
curl -sSI https://accountability.marcbaumholz.de | head -n 5
```

Erwartet:

```
HTTP/2 302
location: https://<team>.cloudflareaccess.com/cdn-cgi/access/login/accountability.marcbaumholz.de?...
```

**`HTTP/2 200` hier heißt: die Policy fehlt.** Zurück zu § 2. Ein `530` oder
`502` heißt: Access hält, der Tunnel nicht — zurück zu § 0.

Der zweite Test, der die eigentliche Sorge adressiert — den Header von außen
mitschicken:

```bash
curl -sSI -H 'Cf-Access-Authenticated-User-Email: marc@example.com' \
  https://accountability.marcbaumholz.de | head -n 1
```

Erwartet: **wieder `302`.** Der Header ist wirkungslos, und zwar nicht, weil
Cloudflare ihn entfernt, sondern weil die Anfrage ohne gültiges
`CF_Authorization`-Cookie den Origin nie erreicht. Auf »Cloudflare filtert das
schon« verlässt sich hier nichts; der Beweis ist der 302.

Danach im Browser einloggen: die Startseite erscheint und begrüßt den
**richtigen** Namen (Abnahme 2). Steht dort der falsche Name, stimmt die
Zuordnung in `ACC_PEOPLE` nicht.

---

## 4 — Die zweite Tür prüfen (Abnahme 3 und 4)

Der Test, den fast jeder überspringt, weil § 3 grün ist. Er prüft das Gegenteil:
Access lässt jemanden durch, und die App muss ihn trotzdem abweisen.

**a) Eine Adresse, die Access erlaubt und `ACC_PEOPLE` nicht kennt**

1. In der Policy aus § 1 eine dritte Adresse hinzufügen, die du selbst abrufen
   kannst (Wegwerf-Gmail oder Alias). `ACC_PEOPLE` **nicht** anfassen.
2. In einem privaten Fenster mit dieser Adresse einloggen (One-time PIN ist der
   schnellste Weg).
3. Erwartet: Access lässt durch, die App zeigt die Seite **»Kein Zugang«** mit
   dem Hinweis auf `ACC_PEOPLE`. Kein Inhalt, keine Namen, keine Wochendaten.
4. Im Container-Log steht die abgewiesene Adresse:

   ```bash
   ssh pi 'docker logs accountability --tail 20 | grep "\[auth\]"'
   ```

   Erwartet: `[auth] Keine Person für dritte@example.com`. Die Adresse steht
   **nur** im Log und nicht in der ausgelieferten Seite — die Antwort spiegelt
   keine Eingabe zurück.
5. Die dritte Adresse **wieder aus der Policy entfernen.** Diesen Schritt jetzt
   machen, nicht später.

> Ehrlicher Vorbehalt zum Statuscode: die Layouts fangen `AuthError` und
> rendern eine lesbare Seite, HTTP-technisch derzeit mit `200`. Abnahme 3 und 4
> sprechen von `403`. Der Zugriff ist verweigert (das ist der Punkt), der Code
> ist es noch nicht. Wer das schließen will, braucht in Next 16
> `authInterrupts` + `forbidden()` in den Layouts — Code, der zu `app/**`
> gehört, nicht zu `lib/auth.ts`.

**b) Ohne Header direkt am Port, auf dem Pi**

```bash
ssh pi
curl -sS http://127.0.0.1:8100/ | grep -o 'Kein Zugang'
curl -sS -H 'Cf-Access-Authenticated-User-Email: fremd@example.com' \
  http://127.0.0.1:8100/ | grep -o 'Kein Zugang'
```

Beide müssen `Kein Zugang` ausgeben. Die erste Zeile ist der Fall »Header
fehlt« (in Produktion gibt es **keinen** Ersatznutzer), die zweite der Fall
»Adresse nicht in der Allowlist«.

Gegenprobe, dass die eigene Adresse am Port funktioniert — das ist gleichzeitig
der bewusst akzeptierte Nachteil aus PRD 08, wer auf dem Pi ist, ist drin:

```bash
curl -sS -H 'Cf-Access-Authenticated-User-Email: <deine-adresse>' \
  http://127.0.0.1:8100/ | grep -o 'Accountability'
```

**c) Der Port ist nicht von außen erreichbar**

Von einem anderen Rechner im LAN:

```bash
nc -vz <pi-ip> 8100    # erwartet: Connection refused / timeout
```

Antwortet der Port, ist das Docker-Port-Mapping falsch (`8100:3000` statt
`127.0.0.1:8100:3000`) und die ganze Header-Argumentation ist hin. Das ist der
einzige Punkt in diesem Runbook, der ein echtes Loch wäre.

---

## 5 — Session-Ablauf und die installierte PWA (Abnahme 6)

Was beim Ablauf passiert: Access antwortet auf **jede** Navigation mit einem
302 auf die Login-Seite. Für die installierte App auf dem Homescreen bedeutet
das drei Dinge.

1. **Der Service Worker darf diese Antwort nicht cachen.** Sonst zeigt die
   installierte App dauerhaft eine Login-Seite, auch nach erfolgreichem Login.
   Der Fix (`response.redirected` → nicht cachen) sitzt in `app/sw.ts` und ist
   Code, keine Dashboard-Regel. Wenn dieser Zustand doch eintritt: einmal
   online neu laden nach dem Login überschreibt den Eintrag; hart zurücksetzen
   heißt App löschen und neu installieren.
2. **Der Login läuft im App-Fenster.** Im `standalone`-Modus gibt es keine
   Adressleiste; ein Google-Login kann in diesem Fenster hängen bleiben.
   Deshalb ist One-time PIN als Identity Provider eingeschaltet — der Weg
   bleibt im Fenster (E-Mail eintippen, PIN eintippen, fertig).
3. **Deshalb `1 month` Session Duration.** Mit 24 Stunden ist dieser Umweg
   Alltag, und eine App, die den Wochenrückblick freundlich machen soll,
   fängt mit einem Login an.

Der Ablauf-Test, sauber und ohne einen Monat zu warten:

1. Auf dem Handy: App vom Homescreen öffnen, sie zeigt den Loop → funktioniert.
2. Im Dashboard **Access → Applications → Accountability → Revoke user
   sessions** (oder auf dem Handy die Cookies der Domain löschen).
3. App vom Homescreen erneut öffnen → Login erscheint, PIN eingeben.
4. Erwartet: **die App**, nicht eine eingefrorene Login-Seite. Danach einmal
   in den Flugmodus und neu öffnen: die Hülle und der letzte Verlauf sind
   lesbar, Schreiben gibt es offline nicht (PRD 08).

Offen und unverifiziert: der **Update-Check des Service Workers**
(`/serwist/sw.js`) ist ein Same-Origin-Fetch und sollte das Access-Cookie
mitbringen. Falls die App sich installiert, aber nie aktualisiert, ist die
Lösung eine eigene Access-Anwendung nur für diesen Pfad mit **Bypass —
Everyone**. Der Service Worker ist ausgelieferter Programmcode, das ist
gefahrlos. Für die App selbst gibt es **nie** eine Bypass-Regel.

---

## Prüfliste zum Abhaken

```
[ ] Tunnel-Route im Journal des Tunnels bestätigt          (§ 0)
[ ] Access-Anwendung angelegt, Session Duration 1 month    (§ 1)
[ ] Policy "Allow / Emails / genau zwei Adressen"          (§ 1)
[ ] Adressen identisch mit ACC_PEOPLE auf dem Pi           (§ 1)
[ ] Applications-Liste zeigt den Policy-Namen, nicht `--`  (§ 2)
[ ] curl von außen → 302 auf cloudflareaccess.com          (§ 3)
[ ] curl von außen MIT gefälschtem Header → weiterhin 302  (§ 3)
[ ] Login zeigt den richtigen Namen                        (§ 3)
[ ] Dritte Adresse in Access, nicht in ACC_PEOPLE → 403    (§ 4a)
[ ] Dritte Adresse aus der Policy wieder entfernt          (§ 4a)
[ ] Am Port ohne Header → Kein Zugang                      (§ 4b)
[ ] Port 8100 von außen nicht erreichbar                   (§ 4c)
[ ] Session widerrufen, neu eingeloggt, keine eingefrorene
    Login-Seite in der installierten App                   (§ 5)
```

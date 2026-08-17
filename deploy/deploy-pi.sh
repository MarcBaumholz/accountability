#!/usr/bin/env bash
#
# Accountability auf den Raspberry Pi bringen.
#
#   bash deploy/deploy-pi.sh
#   PI_HOST=pi@100.124.218.115 bash deploy/deploy-pi.sh   # über Tailscale
#
# Das Image wird AUF dem Pi gebaut: better-sqlite3 ist ein natives Modul und
# muss für arm64 kompiliert werden. Ein lokal gebautes Image ergäbe einen
# Container, der startet und beim ersten Datenbankzugriff stirbt.
#
# Dieses Skript nicht bearbeiten, während es läuft. Bash liest Skripte
# schrittweise vom Dateideskriptor; eine Änderung verschiebt die Byte-Offsets
# unter dem laufenden Interpreter und endet in "unexpected EOF". Wenn es sein
# muss: woandershin kopieren, PROJECT_DIR setzen und die Kopie laufen lassen.
#
set -Eeuo pipefail

# PROJECT_DIR erlaubt genau das: aus einer Kopie heraus laufen, ohne dass das
# Skript sein Projekt an seinem eigenen Ort sucht.
readonly project_dir="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
readonly pi_host="${PI_HOST:-pi@192.168.178.165}"
readonly app_dir="${PI_APP_DIR:-/home/pi/apps/accountability}"
readonly port="${ACC_PORT:-8100}"
readonly domain="${ACC_DOMAIN:-accountability.marcbaumholz.de}"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

# Nicht blind deployen: die Vorprüfung sieht Platz, RAM, Port, Architektur und
# ob die Tunnel-Route wirklich beim Tunnel angekommen ist.
PI_HOST="$pi_host" ACC_PORT="$port" ACC_DOMAIN="$domain" \
  bash "$project_dir/deploy/preflight.sh"

# ACC_PEOPLE braucht es nur, wenn auf dem Pi noch keine .env liegt. Steht sie
# dort schon, wird sie nicht angefasst — und dann muss auf diesem Mac auch keine
# Kopie der echten Adressen liegen.
if ssh "$pi_host" "test -f '$app_dir/.env'"; then
  env_exists=1
else
  env_exists=0
  [ -f "$project_dir/.env.local" ] || {
    echo "FEHLER: auf dem Pi liegt keine .env, und .env.local fehlt hier." >&2
    echo "        Daraus käme ACC_PEOPLE (die zwei erlaubten Adressen)." >&2
    echo "        Vorlage: .env.example" >&2
    exit 1
  }
  grep -qE '^ACC_PEOPLE=' "$project_dir/.env.local" || {
    echo "FEHLER: ACC_PEOPLE steht nicht in .env.local. Ohne die zwei Adressen" >&2
    echo "        gibt es keine Personen in der Datenbank, und niemand kommt herein." >&2
    exit 1
  }
fi

say "Dateien übertragen nach $app_dir"
# Kein --delete: im Zielverzeichnis liegen data/ und .env, die überleben müssen.
# '.env*' ist ausgeschlossen, weil bei LifeOS genau so eine .env.local mit
# Geheimnissen welt-lesbar auf dem Pi landete.
rsync -az \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude data \
  --exclude .DS_Store \
  --exclude '*.log' \
  --exclude '*.tsbuildinfo' \
  --exclude '.env*' \
  "$project_dir/" "$pi_host:$app_dir/"

say "Umgebung auf dem Pi (nur beim ersten Mal geschrieben)"
# Nur ACC_PEOPLE wandert mit. DEV_USER_EMAIL ausdrücklich nicht: es wirkt zwar
# nur bei NODE_ENV != production, aber ein Ersatznutzer hat auf dem Pi nichts zu
# suchen, auch nicht als schlafende Möglichkeit. ACC_DB_PATH setzt
# docker-compose.yml, damit es nicht versehentlich aus dem Volume zeigt.
if [ "$env_exists" -eq 1 ]; then
  echo "  .env existiert schon — unangetastet gelassen"
  ssh "$pi_host" "cut -d= -f1 '$app_dir/.env' | sed 's/^/  Schlüssel: /'"
else
  grep -E '^ACC_PEOPLE=' "$project_dir/.env.local" \
    | ssh "$pi_host" "cat > '$app_dir/.env' && chmod 600 '$app_dir/.env'"
  echo "  .env angelegt (chmod 600)"
fi

say "Datenverzeichnis anlegen"
# Der rsync schließt data/ korrekt aus, also existiert es beim ersten Deploy
# nicht — und `docker compose up` legt eine fehlende Bind-Mount-Quelle selbst
# an, als root:root. Der Container läuft als `node` (uid 1000) und stirbt dann
# mit SQLITE_CANTOPEN. Deshalb: vorher anlegen, mit dem richtigen Eigentümer.
# Ein BESTEHENDES Datenverzeichnis wird nicht angefasst.
ssh "$pi_host" "
  set -e
  if [ -d '$app_dir/data' ]; then
    echo '  existiert schon:'
  else
    mkdir -p '$app_dir/data'
    sudo chown 1000:1000 '$app_dir/data'
    echo '  neu angelegt als uid 1000:'
  fi
  ls -ld '$app_dir/data'
"

say "Container bauen und starten (auf dem Pi einige Minuten)"
ssh "$pi_host" "cd '$app_dir' && docker compose up -d --build"

# Auf die Gesundheit warten, nicht auf den Rückgabewert von compose. Ein
# Container mit Status "Up" ist kein Container, der funktioniert: /healthz liest
# aus der Datenbank und fällt damit auch auf ein falsch gemountetes Volume rein.
say "Health-Gate (bis zu 2 Minuten)"
healthy=0
for i in $(seq 1 30); do
  out="$(ssh "$pi_host" "curl -fsS -m 5 http://127.0.0.1:$port/healthz" 2>/dev/null || true)"
  case "$out" in
    *'"ok":true'*) echo "  $out"; healthy=1; break;;
  esac
  printf '  warte (%s/30)\r' "$i"
  sleep 4
done

if [ "$healthy" -ne 1 ]; then
  echo
  echo "FEHLER: /healthz wurde nicht gesund. Logs:" >&2
  ssh "$pi_host" "cd '$app_dir' && docker compose ps; docker compose logs --tail 60" >&2
  exit 1
fi

# Zusatzprüfung, die eine leere Personentabelle auffliegen lässt: ohne die zwei
# Personen läuft die App, aber jeder Login endet in 403 — und /healthz allein
# wäre trotzdem grün.
people="$(printf '%s' "$out" | sed -n 's/.*"people":\([0-9]*\).*/\1/p')"
if [ "${people:-0}" -ne 2 ]; then
  echo "  WARNUNG: ${people:-0} Person(en) in der Datenbank, erwartet 2."
  echo "           ACC_PEOPLE in $app_dir/.env prüfen und neu starten:"
  echo "             ssh $pi_host \"cd '$app_dir' && docker compose restart\""
else
  echo "  2 Personen in der Datenbank — die Allowlist steht"
fi

say "Zustand"
ssh "$pi_host" "cd '$app_dir' && docker compose ps"

cat <<EOF

==> Fertig. Der Container hört auf 127.0.0.1:$port.

Von außen prüfen — aber nur EINMAL, und erst wenn DNS und Tunnel-Route beide
im Dashboard stehen:

  curl -sI https://$domain | head -1     # erwartet: HTTP/2 302

Grund für die Warnung: die negative DNS-Zwischenspeicherung der Zone liegt bei
1800 s. Ein Lookup, der ins Leere geht, lässt diesen Mac 30 Minuten lang
"Could not resolve host" sagen, lange nachdem der Eintrag existiert. Falls es
doch passiert ist:

  sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

Was der Tunnel wirklich bekommen hat (die Datei /etc/cloudflared/config.yml auf
dem Pi ist tot — remote verwalteter Tunnel):

  ssh $pi_host 'sudo journalctl -u cloudflared -n 30 --no-pager | grep -o "Updated to new configuration.*" | tail -1'

Nächstes Mal geht es schneller: das Image ist gecacht, nur geänderte Schichten
werden neu gebaut.
EOF

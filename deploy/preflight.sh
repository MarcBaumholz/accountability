#!/usr/bin/env bash
#
# Beantwortet "ist Platz da, und wird das funktionieren" BEVOR irgendwas
# übertragen wird. Read-only: ändert auf dem Pi nichts.
#
#   bash deploy/preflight.sh
#   PI_HOST=pi@100.124.218.115 bash deploy/preflight.sh   # über Tailscale
#
# Räumt bewusst NICHT selbst auf. Auf diesem Pi laufen vierzehn andere
# Container, an denen Marc hängt; `docker system prune -af` löscht Images und
# Volumes, die dieses Projekt nie angelegt hat. Zu wenig Platz ist ein Abbruch
# mit Meldung, keine Aufgabe für dieses Skript.
#
set -Eeuo pipefail

readonly pi_host="${PI_HOST:-pi@192.168.178.165}"
readonly port="${ACC_PORT:-8100}"
readonly app="${APP_NAME:-accountability}"
readonly domain="${ACC_DOMAIN:-accountability.marcbaumholz.de}"
fail=0

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok()  { printf '  \033[32mok\033[0m    %s\n' "$*"; }
bad() { printf '  \033[31mFEHLER\033[0m %s\n' "$*"; fail=1; }
warn(){ printf '  \033[33mwarn\033[0m  %s\n' "$*"; }

say "Erreichbarkeit"
if ssh -o BatchMode=yes -o ConnectTimeout=8 "$pi_host" true 2>/dev/null; then
  ok "SSH zu $pi_host"
else
  bad "kein SSH zu $pi_host"
  echo
  echo "  Unterwegs? Tailscale auf dem Mac einschalten und"
  echo "  PI_HOST=pi@100.124.218.115 bash deploy/preflight.sh"
  exit 1
fi

say "Speicherplatz"
ssh "$pi_host" 'df -h / | awk "NR==2{print \"  Gesamt: \"\$2\"  belegt: \"\$3\"  frei: \"\$4\"  (\"\$5\")\"}"'
free_mb="$(ssh "$pi_host" "df -Pm / | awk 'NR==2{print \$4}'")"
# Spitze während des Builds: node_modules ~600 MB plus die Zwischenschichten
# von `next build`. Das fertige Image ist ~350 MB, die Daten ein paar hundert
# Kilobyte.
if   [ "$free_mb" -ge 4000 ]; then ok "${free_mb} MB frei — reicht bequem (Build braucht ~2 GB)"
elif [ "$free_mb" -ge 2500 ]; then warn "${free_mb} MB frei — geht, aber knapp"
else
  bad "${free_mb} MB frei — zu wenig, der Build braucht ~2 GB"
  echo "  Nicht von hier aufräumen: auf dem Pi laufen 14 fremde Container."
  echo "  Was gefahrlos geht, entscheidet Marc:"
  echo "    ssh $pi_host 'docker image ls; docker system df'"
fi

say "Arbeitsspeicher"
ssh "$pi_host" 'free -m | awk "/^Mem:/{print \"  RAM: \"\$2\" MB, frei \"\$7\" MB\"} /^Swap:/{print \"  Swap: \"\$2\" MB\"}"'
mem_mb="$(ssh "$pi_host" "free -m | awk '/^Mem:/{print \$2}'")"
[ "$mem_mb" -ge 3500 ] && ok "genug RAM für den Next.js-Build" \
  || warn "${mem_mb} MB RAM — der Build kann knapp werden. Swap hilft."

say "Docker"
ssh "$pi_host" 'docker --version 2>/dev/null | sed "s/^/  /" || echo "  nicht installiert"'
ssh "$pi_host" 'docker compose version 2>/dev/null | sed "s/^/  /" || echo "  compose fehlt"'
ssh "$pi_host" 'docker system df 2>/dev/null | sed "s/^/  /"' || true

say "Architektur (better-sqlite3 wird hier kompiliert)"
ssh "$pi_host" 'uname -m | sed "s/^/  /"'
arch="$(ssh "$pi_host" 'uname -m')"
[ "$arch" = aarch64 ] && ok "arm64 — das Image wird auf dem Pi gebaut, nicht mitgebracht" \
  || warn "unerwartete Architektur: $arch"

say "Port $port"
# Der eigene Container darf den Port halten — das ist ein Redeploy, kein
# Konflikt. Die erste Version dieser Prüfung verweigerte den Redeploy der App,
# weil die App lief.
if ssh "$pi_host" "ss -ltn 2>/dev/null | grep -q ':$port '"; then
  if ssh "$pi_host" "docker ps --filter name=$app --format '{{.Ports}}' 2>/dev/null | grep -q ':$port'"; then
    ok "Port $port wird vom eigenen $app-Container gehalten (Redeploy)"
  else
    bad "Port $port ist von etwas Fremdem belegt"
    ssh "$pi_host" "ss -ltnp 2>/dev/null | grep ':$port '" || true
  fi
else
  ok "Port $port ist frei"
fi

say "Belegte App-Ports der anderen Apps (Portkarte im pi-deploy-Skill)"
ssh "$pi_host" 'ss -ltn 2>/dev/null | awk "/127.0.0.1:(80|81)/ {print \"  \"\$4}" | sort -u' || true

say "Laufende Container"
ssh "$pi_host" 'docker ps --format "  {{.Names}}  {{.Status}}" 2>/dev/null' || true

say "Cloudflare Tunnel"
ssh "$pi_host" 'systemctl is-active cloudflared 2>/dev/null | sed "s/^/  cloudflared: /" || echo "  cloudflared: unbekannt"'
# Die EINZIGE ehrliche Quelle für die Routen. /etc/cloudflared/config.yml auf
# dem Pi ist tot: der Tunnel ist remote verwaltet und zieht seine Konfiguration
# von Cloudflare. Die Datei zu bearbeiten ändert nichts, ohne Fehlermeldung.
route="$(ssh "$pi_host" 'sudo journalctl -u cloudflared -n 200 --no-pager 2>/dev/null | grep -o "Updated to new configuration.*" | tail -1' || true)"
if [ -z "$route" ]; then
  warn "keine Konfigurationszeile im Journal gefunden (evtl. zu alt) — Route im Dashboard prüfen"
elif printf '%s' "$route" | grep -q "$domain"; then
  ok "Tunnel-Route für $domain ist beim Tunnel angekommen"
else
  warn "$domain ist NICHT in der Tunnel-Konfiguration"
  echo "    Das ist Dashboard-Arbeit (Networks > Tunnels > n8n-tunnel >"
  echo "    Published application routes) und blockiert den Deploy nicht —"
  echo "    der Container läuft danach trotzdem auf 127.0.0.1:$port."
fi

echo
if [ "$fail" -eq 0 ]; then
  printf '\033[32mBereit.\033[0m Deploy mit:  PI_HOST=%s bash deploy/deploy-pi.sh\n' "$pi_host"
else
  printf '\033[31mNoch nicht bereit.\033[0m Siehe FEHLER oben.\n'
  exit 1
fi

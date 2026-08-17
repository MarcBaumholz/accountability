#!/usr/bin/env bash
#
# Richtet das nächtliche Accountability-Backup auf dem Pi ein.
#
#   bash deploy/backup-install.sh
#
# Idempotent: mehrfaches Ausführen ändert nichts weiter. Läuft das Backup am
# Ende einmal wirklich — eine Sicherung, die nie lief, ist keine — und
# restauriert die entstandene Kopie danach in ein Wegwerf-Verzeichnis und zählt
# dort die Zeilen nach. Das ist der Unterschied zwischen einem Backup und einer
# Datei, die so aussieht.
#
set -Eeuo pipefail

readonly pi_host="${PI_HOST:-pi@192.168.178.165}"
readonly app_dir="${PI_APP_DIR:-/home/pi/apps/accountability}"
readonly dest="${BACKUP_DEST:-/home/pi/backups/accountability}"
readonly keep="${KEEP:-14}"

readonly project_dir="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

say "Voraussetzung: sqlite3 auf dem Pi"
ssh "$pi_host" 'command -v sqlite3 >/dev/null || sudo apt-get install -y -qq sqlite3'
ssh "$pi_host" 'sqlite3 --version | sed "s/^/  /"'

say "Units und Env-Datei schreiben"
scp -q "$project_dir/deploy/accountability-backup.service" \
       "$project_dir/deploy/accountability-backup.timer" "$pi_host:/tmp/"
ssh "$pi_host" "
  set -e
  sudo install -m 644 /tmp/accountability-backup.service /etc/systemd/system/
  sudo install -m 644 /tmp/accountability-backup.timer   /etc/systemd/system/
  rm -f /tmp/accountability-backup.service /tmp/accountability-backup.timer
  printf 'ACC_DATA_DIR=%s/data\nBACKUP_DEST=%s\nKEEP=%s\n' \
    '$app_dir' '$dest' '$keep' | sudo tee /etc/accountability-backup.env >/dev/null
  sudo chmod 644 /etc/accountability-backup.env
  chmod +x '$app_dir/scripts/backup-pi.sh'
  mkdir -p '$dest'
"

say "Timer aktivieren"
ssh "$pi_host" 'sudo systemctl daemon-reload && sudo systemctl enable --now accountability-backup.timer'

say "Einmal jetzt laufen lassen (der Beweis, dass es geht)"
ssh "$pi_host" 'sudo systemctl start accountability-backup.service'
ssh "$pi_host" 'systemctl status accountability-backup.service --no-pager | tail -8'

say "Restore-Probe in ein Wegwerf-Verzeichnis, direkt auf dem Pi"
# Genau hier trennt sich ein Backup von einer Vermutung: entpacken,
# integrity_check, Zeilen zählen. Das Verzeichnis wird danach gelöscht, die
# lebende Datenbank wird nicht angefasst.
ssh "$pi_host" "
  set -e
  newest=\"\$(ls -t '$dest'/accountability-*.tar.gz | head -1)\"
  tmp=\"\$(mktemp -d)\"
  trap 'rm -rf \"\$tmp\"' EXIT
  tar -xzf \"\$newest\" -C \"\$tmp\"
  echo \"  Archiv:  \$(basename \"\$newest\")\"
  echo \"  integrity_check: \$(sqlite3 \"\$tmp/accountability.db\" 'PRAGMA integrity_check;')\"
  for t in person entry item value goal prio_review value_check partner_note; do
    printf '  %-14s %s\n' \"\$t\" \"\$(sqlite3 \"\$tmp/accountability.db\" \"SELECT COUNT(*) FROM \$t;\")\"
  done
"

say "Ergebnis"
ssh "$pi_host" "ls -lh '$dest' | sed 's/^/  /'"
ssh "$pi_host" 'systemctl list-timers accountability-backup.timer --no-pager | sed "s/^/  /"'

cat <<EOF

==> Eingerichtet. Nächtlich um 04:10, ${keep} Archive werden behalten.

Aber deutlich gesagt: dieses Backup liegt auf derselben SD-Karte wie die
Datenbank. Es schützt gegen Bugs, Versehen und misslungene Deploys, NICHT gegen
den Tod der Karte. Die Kopie, die das Gerät verlässt, holt man vom Mac:

  bash scripts/pull-backup.sh
EOF

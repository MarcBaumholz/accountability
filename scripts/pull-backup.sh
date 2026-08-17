#!/usr/bin/env bash
#
# Holt die Accountability-Backups vom Pi auf diesen Rechner.
#
#   bash scripts/pull-backup.sh
#   PI_HOST=pi@100.124.218.115 bash scripts/pull-backup.sh   # über Tailscale
#
# Warum das getrennt vom nächtlichen Backup läuft: das Backup auf dem Pi liegt
# auf derselben SD-Karte wie die Datenbank. Gegen einen Bug oder ein Versehen
# hilft es, gegen einen Kartentod nicht. Erst diese Kopie verlässt das Gerät.
#
# Prüft das neueste geholte Archiv wirklich nach — restauriert es in ein
# Wegwerf-Verzeichnis, führt integrity_check aus und zählt die Zeilen. Ein
# Archiv, das niemand geöffnet hat, ist kein Backup, sondern eine Datei.
#
set -Eeuo pipefail

readonly pi_host="${PI_HOST:-pi@192.168.178.165}"
readonly remote="${REMOTE_DIR:-/home/pi/backups/accountability}"
readonly local_dir="${LOCAL_DIR:-$HOME/Backups/accountability}"

mkdir -p "$local_dir"

printf '\n\033[1m==> holen von %s\033[0m\n' "$pi_host"
rsync -avh --progress "$pi_host:$remote/" "$local_dir/"

newest="$(ls -t "$local_dir"/accountability-*.tar.gz 2>/dev/null | head -1)"
[ -n "$newest" ] || { echo "keine Archive geholt" >&2; exit 1; }

printf '\n\033[1m==> neuestes Archiv wirklich restaurieren und nachzählen\033[0m\n'
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
tar -xzf "$newest" -C "$tmp"

if command -v sqlite3 >/dev/null; then
  check="$(sqlite3 "$tmp/accountability.db" 'PRAGMA integrity_check;')"
  [ "$check" = ok ] || { echo "integrity_check: $check" >&2; exit 1; }
  echo "  $(basename "$newest"): integrity_check ok"
  for t in person entry item value goal prio_review value_check partner_note; do
    printf '  %-14s %s\n' "$t" "$(sqlite3 "$tmp/accountability.db" "SELECT COUNT(*) FROM $t;")"
  done
  # Zwei Personen sind der harte Erwartungswert dieser App. Alles andere heißt:
  # falsche Datenbank gesichert, oder ACC_PEOPLE auf dem Pi ist kaputt.
  people="$(sqlite3 "$tmp/accountability.db" 'SELECT COUNT(*) FROM person;')"
  [ "$people" -eq 2 ] || echo "  WARNUNG: $people Personen, erwartet 2"
else
  echo "  sqlite3 fehlt hier, nur entpackt geprüft: $(ls -1 "$tmp" | tr '\n' ' ')"
fi

echo
echo "  $(ls -1 "$local_dir"/accountability-*.tar.gz | wc -l | tr -d ' ') Archive in $local_dir"
echo "  belegt: $(du -sh "$local_dir" | cut -f1)"

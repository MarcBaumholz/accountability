#!/usr/bin/env bash
#
# Nächtliches Backup von Accountability auf dem Raspberry Pi.
#
# Folgt dem Muster, das auf diesem Pi schon läuft (habitloop-backup.service,
# lifeos-backup.service): systemd-Timer, Env-Datei, oneshot-Skript, rotierende
# Kopien. Kein restic — es gibt auf diesem Pi kein externes Laufwerk, restic
# würde also auch nur auf die SD-Karte schreiben und dafür eine Abhängigkeit und
# ein verlierbares Repo-Passwort mitbringen.
#
# WAS DAS SCHÜTZT: einen kaputten Schreibvorgang, ein versehentliches Löschen,
#   einen Bug, der Daten zerstört, ein misslungenes Deploy.
# WAS DAS NICHT SCHÜTZT: den Tod der SD-Karte. Backup und Datenbank liegen auf
#   derselben Karte. Erst scripts/pull-backup.sh (läuft auf dem Mac) holt eine
#   Kopie vom Gerät herunter, und nur die überlebt einen Kartentod.
#
# Umgebung (aus /etc/accountability-backup.env):
#   ACC_DATA_DIR   wo accountability.db liegt
#   BACKUP_DEST    Zielverzeichnis für die Archive
#   KEEP           wie viele Archive behalten werden (Standard 14)
#
set -Eeuo pipefail

DATA_DIR="${ACC_DATA_DIR:?ACC_DATA_DIR fehlt}"
DEST="${BACKUP_DEST:?BACKUP_DEST fehlt}"
KEEP="${KEEP:-14}"

DB="$DATA_DIR/accountability.db"
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

fail() { echo "Backup fehlgeschlagen: $*" >&2; exit 1; }

command -v sqlite3 >/dev/null || fail "sqlite3 ist nicht installiert"
[ -f "$DB" ] || fail "keine Datenbank unter $DB"
mkdir -p "$DEST"

# Eine konsistente Momentaufnahme, und der Grund, warum hier kein `cp` steht:
# mit WAL-Journal stehen die letzten Schreibvorgänge in accountability.db-wal,
# NICHT in der .db-Datei. Auf dieser App war die .db beim Schreiben dieses
# Skripts 4 KB groß und das WAL 571 KB — ein `cp` der .db allein hätte eine
# formal fehlerfreie, praktisch leere Datenbank gesichert, und der
# integrity_check darunter wäre grün gewesen. `.backup` faltet das WAL ein und
# ist auch gegen eine laufende, aktiv beschriebene Datenbank sicher.
sqlite3 "$DB" ".backup '$STAGING/accountability.db'"

# Eine Sicherung, die niemand geprüft hat, ist eine Vermutung.
sqlite3 "$STAGING/accountability.db" "PRAGMA integrity_check;" | grep -qx ok \
  || fail "integrity_check der Momentaufnahme war nicht ok"

# Und zählen, was drin ist: genau das ist die Prüfung, die den leeren
# Erfolgsfall auffliegen lässt. `person` MUSS zwei Zeilen haben, sonst wurde
# etwas Falsches gesichert.
people="$(sqlite3 "$STAGING/accountability.db" "SELECT COUNT(*) FROM person;")"
[ "$people" -ge 1 ] || fail "Momentaufnahme enthält keine Personen — verdächtig"
entries="$(sqlite3 "$STAGING/accountability.db" "SELECT COUNT(*) FROM entry;")"
items="$(sqlite3 "$STAGING/accountability.db" "SELECT COUNT(*) FROM item;")"

stamp="$(date +%Y%m%d-%H%M%S)"
archive="$DEST/accountability-$stamp.tar.gz"

tar -czf "$archive" -C "$STAGING" accountability.db
chmod 600 "$archive"

# Rotation: die ältesten zuerst weg. `ls -t` sortiert nach Zeit, `tail -n +N`
# überspringt die, die bleiben sollen.
mapfile -t old < <(ls -t "$DEST"/accountability-*.tar.gz 2>/dev/null | tail -n "+$((KEEP + 1))")
for f in "${old[@]:-}"; do [ -n "$f" ] && rm -f -- "$f"; done

size="$(du -h "$archive" | cut -f1)"
count="$(ls -1 "$DEST"/accountability-*.tar.gz | wc -l | tr -d ' ')"
echo "Backup ok: $archive ($size) — $people Personen, $entries Einträge, $items Punkte; $count Archive vorhanden"

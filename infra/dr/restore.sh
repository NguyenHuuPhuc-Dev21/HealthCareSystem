#!/bin/sh
# =====================================================================
# Point-in-Time Recovery into a NEW data directory, on a separate port (never over the live cluster).
# (BE-2 · Phase 8 · NFR-AVAIL-01: RTO ≤ 4 h)
#
#   sh restore.sh <base-backup-dir | LATEST> "<target time, e.g. 2026-11-26 10:15:00+07>" [port] [data-dir]
#
# Runs as the postgres OS user. Env: BACKUP_DIR (/backups). Default port 5433, data dir /tmp/pitr.
# The restored server is promoted at the target and keeps running; check it with `npm run ops:dr-verify`, then
# either switch the application to it (real incident) or stop it: pg_ctl -D <data-dir> stop (drill).
# =====================================================================
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
SOCK="${PGHOST:-/var/run/postgresql}"
BASE="${1:?base backup dir or LATEST}"
TARGET="${2:?target time}"
PORT="${3:-5433}"
DATA="${4:-/tmp/pitr}"

[ "$BASE" = "LATEST" ] && BASE="$BACKUP_DIR/base/$(cat "$BACKUP_DIR/base/LATEST")"
[ -f "$BASE/base.tar.gz" ] || { echo "[restore] no base.tar.gz in $BASE" >&2; exit 2; }
if [ -e "$DATA" ] && [ -n "$(ls -A "$DATA" 2>/dev/null)" ]; then
  echo "[restore] $DATA is not empty — refusing to overwrite" >&2; exit 2
fi

START_EPOCH="$(date +%s)"
echo "[restore] base=$BASE target='$TARGET' port=$PORT data=$DATA"
mkdir -p "$DATA" && chmod 700 "$DATA"
tar -xzf "$BASE/base.tar.gz" -C "$DATA"
if [ -f "$BASE/pg_wal.tar.gz" ]; then mkdir -p "$DATA/pg_wal" && tar -xzf "$BASE/pg_wal.tar.gz" -C "$DATA/pg_wal"; fi

cat >> "$DATA/postgresql.auto.conf" <<CONF
# --- PITR (restore.sh) ---
restore_command = 'cp $BACKUP_DIR/wal/%f %p'
recovery_target_time = '$TARGET'
recovery_target_inclusive = true
recovery_target_action = 'promote'
archive_mode = off
port = $PORT
listen_addresses = '*'
unix_socket_directories = '$SOCK'
CONF
touch "$DATA/recovery.signal"

pg_ctl -D "$DATA" -l "$DATA/restore.log" -w -t 14400 start >/dev/null
# wait for the end of recovery (promotion)
i=0
until [ "$(psql -X -p "$PORT" -h "$SOCK" -d postgres -tAc 'select pg_is_in_recovery()' 2>/dev/null)" = "f" ]; do
  i=$((i + 1)); [ "$i" -gt 14400 ] && { echo "[restore] recovery did not finish, see $DATA/restore.log" >&2; exit 3; }
  sleep 1
done
END_EPOCH="$(date +%s)"
echo "[restore] promoted — restore took $((END_EPOCH - START_EPOCH)) s (RTO budget 4 h = 14400 s)"
echo "[restore] last replayed: $(grep -E 'recovery stopping|last completed transaction' "$DATA/restore.log" | tail -n 1)"

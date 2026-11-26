#!/bin/sh
# =====================================================================
# Disaster-recovery drill (BE-2 · Phase 8 · checklist "daily backup snapshot + PITR verification — RPO ≤ 1h
# (wallets) / ≤ 24h (logs), RTO ≤ 4h"). Proves, on a running cluster, that:
#   1. a base backup can be taken;
#   2. a write made BEFORE the chosen target time comes back, one made AFTER it does not (PITR is exact);
#   3. the whole restore fits the 4 h RTO; the data lost at the target (RPO) is measured.
# Writes only to its own database `dr_probe` — application data is read, never touched.
#
#   docker exec -u postgres healthcare_postgres sh /dr/drill.sh
# Env: BACKUP_DIR (/backups) · RESTORE_PORT (5433) · RESTORE_DIR (/tmp/pitr-drill) · KEEP_RESTORED=1 to keep it running
# Then, from the repo: npm run ops:dr-verify -- --restored=<url :5433> --target="<printed target>"
# =====================================================================
set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RESTORE_PORT="${RESTORE_PORT:-5433}"
RESTORE_DIR="${RESTORE_DIR:-/tmp/pitr-drill}"
SOCK="${PGHOST:-/var/run/postgresql}"
export BACKUP_DIR

q() { psql -X -v ON_ERROR_STOP=1 -h "$SOCK" -tAc "$2" "$1"; }

echo "== 0. pre-checks"
[ "$(q postgres 'show archive_mode')" = "on" ] || { echo "archive_mode is off — start with infra/docker/docker-compose.dr.yml" >&2; exit 2; }
echo "archive_timeout=$(q postgres 'show archive_timeout')  archived=$(q postgres 'select archived_count from pg_stat_archiver')  failed=$(q postgres 'select failed_count from pg_stat_archiver')"
if [ -e "$RESTORE_DIR" ]; then
  pg_ctl -D "$RESTORE_DIR" stop -m fast >/dev/null 2>&1 || true
  rm -rf "$RESTORE_DIR"
fi

echo "== 1. base backup"
sh "$HERE/backup.sh"
BASE="$BACKUP_DIR/base/$(cat "$BACKUP_DIR/base/LATEST")"

echo "== 2. probe writes around the target"
q postgres "select 1 from pg_database where datname = 'dr_probe'" | grep -q 1 || q postgres "create database dr_probe"
q dr_probe "create table if not exists probe (id bigserial primary key, run text not null, label text not null, at timestamptz not null default clock_timestamp())"
RUN="$(date -u +%Y%m%dT%H%M%SZ)"
q dr_probe "insert into probe (run, label) values ('$RUN', 'before-1'), ('$RUN', 'before-2')" >/dev/null
sleep 2
TARGET="$(q postgres "select to_char(clock_timestamp(), 'YYYY-MM-DD HH24:MI:SS.US TZH:TZM')")"
sleep 2
q dr_probe "insert into probe (run, label) values ('$RUN', 'after-target')" >/dev/null
# close the WAL segment so the archive holds everything up to now, then wait for the archiver
SEG="$(q postgres 'select pg_walfile_name(pg_switch_wal())')"
i=0
until [ -f "$BACKUP_DIR/wal/$SEG" ]; do
  i=$((i + 1)); [ "$i" -gt 120 ] && { echo "WAL $SEG not archived after 120 s — check archive_command" >&2; exit 3; }
  sleep 1
done
echo "target = $TARGET   (run $RUN, last WAL $SEG archived)"

echo "== 3. point-in-time restore → port $RESTORE_PORT"
T0="$(date +%s)"
sh "$HERE/restore.sh" "$BASE" "$TARGET" "$RESTORE_PORT" "$RESTORE_DIR"
T1="$(date +%s)"

echo "== 4. checks on the restored server"
r() { psql -X -h "$SOCK" -p "$RESTORE_PORT" -tAc "$2" "$1"; }
BEFORE="$(r dr_probe "select count(*) from probe where run = '$RUN' and label like 'before-%'")"
AFTER="$(r dr_probe "select count(*) from probe where run = '$RUN' and label = 'after-target'")"
LAST="$(r dr_probe "select to_char(max(at), 'YYYY-MM-DD HH24:MI:SS.US TZH:TZM') from probe where run = '$RUN'")"
LOSS="$(r dr_probe "select round(extract(epoch from ('$TARGET'::timestamptz - max(at)))::numeric, 1) from probe where run = '$RUN'")"
RTO=$((T1 - T0))
OK=1
[ "$BEFORE" = "2" ] || { echo "FAIL: writes before the target are missing ($BEFORE/2)"; OK=0; }
[ "$AFTER" = "0" ] || { echo "FAIL: a write after the target came back — recovery overshot"; OK=0; }
[ "$RTO" -le 14400 ] || { echo "FAIL: restore took $RTO s > RTO 4 h"; OK=0; }

echo "-----------------------------------------------------------------"
echo "DR drill $RUN"
echo "  base backup      : $BASE"
echo "  target           : $TARGET"
echo "  restored up to   : $LAST  (gap to target ${LOSS} s — the drill's RPO; budget wallets 3600 s, logs 86400 s)"
echo "  before / after   : $BEFORE of 2 present / $AFTER of 1 present (expected 2 / 0)"
echo "  restore time     : $RTO s (RTO budget 14400 s)"
echo "  restored server  : port $RESTORE_PORT, data $RESTORE_DIR"
echo "  next             : npm run ops:dr-verify -- --restored=postgresql://postgres:<pw>@localhost:$RESTORE_PORT/<db> --target=\"$TARGET\""
echo "-----------------------------------------------------------------"

if [ "${KEEP_RESTORED:-0}" != "1" ]; then
  pg_ctl -D "$RESTORE_DIR" stop -m fast >/dev/null && echo "restored server stopped (KEEP_RESTORED=1 to keep it for dr-verify)"
fi
[ "$OK" = "1" ] && echo "RESULT: PASS" || { echo "RESULT: FAIL"; exit 1; }

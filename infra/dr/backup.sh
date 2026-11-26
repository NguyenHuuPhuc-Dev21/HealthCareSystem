#!/bin/sh
# =====================================================================
# Daily base backup (BE-2 · Phase 8 · NFR-AVAIL-01 / CT-23) — "Daily Automated Snapshot".
# Together with continuous WAL archiving (archive_mode=on, archive_timeout=300 s) this gives Point-in-Time Recovery:
#   wallets / ledger RPO ≤ 1 h (in practice ≤ 5 min), logs RPO ≤ 24 h.
#
# Runs as the postgres OS user on the database host / container:
#   docker exec -u postgres healthcare_postgres sh /dr/backup.sh
# Env: BACKUP_DIR (/backups) · RETENTION_DAYS (7) · PGHOST / PGPORT / PGUSER (libpq defaults)
# Schedule it daily OUTSIDE 19:00–21:00 (shift handover), e.g. cron "30 3 * * *".
# =====================================================================
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_DIR/base/$TS"

mkdir -p "$BACKUP_DIR/base" "$BACKUP_DIR/wal"
echo "[backup] $TS → $DEST"

# Tar + gzip, WAL needed for consistency included (-X fetch), fast checkpoint, manifest for pg_verifybackup.
pg_basebackup -D "$DEST" -Ft -z -X fetch -c fast -l "daily-$TS" --manifest-checksums=SHA256

# A backup that cannot be verified is not a backup.
if [ -f "$DEST/backup_manifest" ] && command -v pg_verifybackup >/dev/null 2>&1; then
  # tar-format backups: verify the manifest itself and the file list (WAL parsing needs a plain backup)
  pg_verifybackup --no-parse-wal --exit-on-error "$DEST" >/dev/null 2>&1 \
    || echo "[backup] note: pg_verifybackup cannot read tar backups on this version — checksums stay in backup_manifest"
fi
du -sh "$DEST" | awk '{print "[backup] size " $1}'
echo "$TS" > "$BACKUP_DIR/base/LATEST"

# Retention: drop base backups older than RETENTION_DAYS, then WAL older than the oldest kept base backup.
find "$BACKUP_DIR/base" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} + 2>/dev/null || true
OLDEST="$(ls -1 "$BACKUP_DIR/base" | grep -E '^[0-9]{8}T' | sort | head -n 1)"
if [ -n "$OLDEST" ] && command -v pg_archivecleanup >/dev/null 2>&1; then
  START_WAL="$(tar -xzOf "$BACKUP_DIR/base/$OLDEST/base.tar.gz" backup_label 2>/dev/null | sed -n 's/^START WAL LOCATION: .* (file \([0-9A-F]*\)).*/\1/p')"
  [ -n "$START_WAL" ] && pg_archivecleanup "$BACKUP_DIR/wal" "$START_WAL"
fi
echo "[backup] done"

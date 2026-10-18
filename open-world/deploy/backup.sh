#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$(readlink -f "$0")")"
backup_dir="$HOME/abyss/backups"
mkdir -p "$backup_dir"
exec 9>"$backup_dir/.backup.lock"
flock -n 9 || exit 0
file="$backup_dir/abyss-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
trap 'rm -f "$file.partial"' EXIT
docker compose exec -T db pg_dump -U abyss -d abyss | gzip > "$file.partial"
gzip -t "$file.partial"
mv "$file.partial" "$file"
find "$backup_dir" -maxdepth 1 -type f -name 'abyss-*.sql.gz' -mmin +10080 -delete
printf '%s\n' "$file"

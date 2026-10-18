#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"
# Ubuntu cron follows the host timezone (this host is Asia/Shanghai).
# Run a tiny hourly guard: UTC hour 04 is the only time a dump is made.
entry="0 * * * * test \"\$(date -u +\%H)\" = 04 && /bin/bash $PWD/backup.sh >> $HOME/abyss/backups/cron.log 2>&1 # abyss-daily-backup"
mkdir -p "$HOME/abyss/backups"
existing=$(crontab -l 2>/dev/null || true)
{ printf '%s\n' "$existing" | sed '/# abyss-daily-backup$/d'; printf '%s\n' "$entry"; } | crontab -
crontab -l | grep '# abyss-daily-backup$'

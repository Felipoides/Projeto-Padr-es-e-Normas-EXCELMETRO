#!/bin/bash
# ============================================================================
#  MetroControl — Backup do SQLite (cópia do arquivo .db)
#  Uso:  ./scripts/backup-sqlite.sh
# ============================================================================
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_FILE="${DB_PATH:-$DIR/data/metrocontrol.db}"
BACKUP_DIR="$DIR/backups"
mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_FILE" ]; then
    echo "Erro: banco não encontrado em $DB_FILE"
    exit 1
fi

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
DESTINO="$BACKUP_DIR/metrocontrol-sqlite-$TIMESTAMP.db"

# Cópia segura via sqlite3 .backup (evita corrupção com WAL ativo)
if command -v sqlite3 &>/dev/null; then
    sqlite3 "$DB_FILE" ".backup '$DESTINO'"
else
    cp "$DB_FILE" "$DESTINO"
    # Copia WAL/SHM se existirem
    [ -f "${DB_FILE}-wal" ] && cp "${DB_FILE}-wal" "${DESTINO}-wal"
    [ -f "${DB_FILE}-shm" ] && cp "${DB_FILE}-shm" "${DESTINO}-shm"
fi

TAMANHO=$(du -h "$DESTINO" | cut -f1)
echo ""
echo "  Backup SQLite salvo!"
echo "  Arquivo: $DESTINO"
echo "  Tamanho: $TAMANHO"
echo ""
echo "  Para restaurar:"
echo "    cp $DESTINO $DB_FILE"
echo "    (e reinicie o servidor)"
echo ""

# Manter apenas os 10 backups mais recentes
cd "$BACKUP_DIR"
ls -t metrocontrol-sqlite-*.db 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true

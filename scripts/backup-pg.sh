#!/bin/bash
# ============================================================================
#  MetroControl — Backup do PostgreSQL via pg_dump
#  Uso:  ./scripts/backup-pg.sh
#  Requer: pg_dump instalado e DATABASE_URL definida (ou variáveis PG*)
# ============================================================================
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
mkdir -p "$DIR"

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
ARQUIVO="$DIR/metrocontrol-pg-$TIMESTAMP.sql.gz"

# Conexão: usa DATABASE_URL ou variáveis padrão do PostgreSQL
if [ -n "${DATABASE_URL:-}" ]; then
    echo "Conectando via DATABASE_URL..."
    pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip > "$ARQUIVO"
elif [ -n "${PGDATABASE:-}" ]; then
    echo "Conectando via PGDATABASE=$PGDATABASE..."
    pg_dump --no-owner --no-acl | gzip > "$ARQUIVO"
else
    # Padrão local
    DB="${1:-metrocontrol}"
    USER="${2:-metro}"
    echo "Conectando: banco=$DB usuario=$USER (local)..."
    pg_dump -U "$USER" -d "$DB" --no-owner --no-acl | gzip > "$ARQUIVO"
fi

TAMANHO=$(du -h "$ARQUIVO" | cut -f1)
echo ""
echo "  Backup salvo com sucesso!"
echo "  Arquivo: $ARQUIVO"
echo "  Tamanho: $TAMANHO"
echo ""
echo "  Para restaurar:"
echo "    ./scripts/restaurar-pg.sh $ARQUIVO"
echo ""

# Limpeza: manter apenas os 10 backups mais recentes
cd "$DIR"
ls -t metrocontrol-pg-*.sql.gz 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
TOTAL=$(ls metrocontrol-pg-*.sql.gz 2>/dev/null | wc -l)
echo "  Backups armazenados: $TOTAL (máximo 10)"

#!/bin/bash
# ============================================================================
#  MetroControl — Restaurar backup PostgreSQL
#  Uso:  ./scripts/restaurar-pg.sh backups/metrocontrol-pg-2026-06-24_18-00-00.sql.gz
#  Requer: psql instalado e DATABASE_URL ou variáveis PG*
# ============================================================================
set -euo pipefail

ARQUIVO="${1:-}"
if [ -z "$ARQUIVO" ]; then
    echo "Uso: $0 <arquivo-backup.sql.gz>"
    echo ""
    echo "Backups disponíveis:"
    ls -lh "$(dirname "$0")/../backups"/metrocontrol-pg-*.sql.gz 2>/dev/null || echo "  Nenhum backup encontrado."
    exit 1
fi

if [ ! -f "$ARQUIVO" ]; then
    echo "Erro: arquivo não encontrado: $ARQUIVO"
    exit 1
fi

echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║  ATENÇÃO: RESTAURAÇÃO DESTRUTIVA                     ║"
echo "  ║  Todos os dados atuais serão SUBSTITUÍDOS!           ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Arquivo: $ARQUIVO"
echo ""
read -rp "  Tem certeza? Digite 'SIM' para confirmar: " CONFIRM
if [ "$CONFIRM" != "SIM" ]; then
    echo "  Cancelado."
    exit 0
fi

echo ""
echo "  Restaurando..."

if [ -n "${DATABASE_URL:-}" ]; then
    gunzip -c "$ARQUIVO" | psql "$DATABASE_URL" --quiet
elif [ -n "${PGDATABASE:-}" ]; then
    gunzip -c "$ARQUIVO" | psql --quiet
else
    DB="${2:-metrocontrol}"
    USER="${3:-metro}"
    gunzip -c "$ARQUIVO" | psql -U "$USER" -d "$DB" --quiet
fi

echo ""
echo "  Restauração concluída com sucesso!"
echo "  Reinicie o servidor para garantir consistência:"
echo "    npm start"
echo ""

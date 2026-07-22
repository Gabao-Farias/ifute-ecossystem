#!/usr/bin/env bash
# Coleta métricas do host durante o teste de carga. Numa VPS única o teto real
# quase nunca é o Express — é CPU, ou (mais provável) o Postgres/pool de conexões.
# Rode em paralelo ao k6 (numa sessão SSH separada na VPS) e correlacione o
# instante em que a saturação aparece no k6 com o que estourou aqui.
#
# Uso (na VPS, via SSH):
#   ./monitor-host.sh <container_do_postgres> [intervalo_seg] > monitor-$(date +%s).log
#
# Ex.: ./monitor-host.sh ifute-postgres 5

set -euo pipefail

PG_CONTAINER="${1:-ifute-postgres}"
INTERVAL="${2:-5}"

# Ajuste se o usuário/DB forem outros (veja o .env do compose).
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-ifute}"

echo "== monitor iniciado: $(date -u +%FT%TZ) | pg_container=$PG_CONTAINER | intervalo=${INTERVAL}s =="

psql() { docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAc "$1"; }

while true; do
  TS="$(date -u +%FT%TZ)"

  # --- Host: CPU load + memória ---
  LOAD="$(cut -d' ' -f1-3 /proc/loadavg)"
  MEM="$(free -m | awk '/Mem:/{printf "used=%sMB free=%sMB", $3, $4}')"

  # --- Docker: uso por container (uma foto) ---
  echo "[$TS] load(1/5/15)=$LOAD | $MEM"
  docker stats --no-stream --format \
    '    {{.Name}}: cpu={{.CPUPerc}} mem={{.MemUsage}} net={{.NetIO}}' \
    2>/dev/null || true

  # --- Postgres: conexões vs teto ---
  CONNS="$(psql "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null || echo '?')"
  MAXC="$(psql "SHOW max_connections;" 2>/dev/null || echo '?')"
  ACTIVE="$(psql "SELECT count(*) FROM pg_stat_activity WHERE state='active';" 2>/dev/null || echo '?')"
  WAITING="$(psql "SELECT count(*) FROM pg_stat_activity WHERE wait_event IS NOT NULL AND state='active';" 2>/dev/null || echo '?')"
  echo "    pg: conns=$CONNS/$MAXC active=$ACTIVE waiting_on_event=$WAITING"

  # --- Postgres: query ativa mais antiga (sinal de query lenta/lock) ---
  SLOW="$(psql "SELECT COALESCE(max(EXTRACT(EPOCH FROM (now()-query_start)))::int,0) FROM pg_stat_activity WHERE state='active' AND query NOT ILIKE '%pg_stat_activity%';" 2>/dev/null || echo '?')"
  echo "    pg: oldest_active_query=${SLOW}s"

  sleep "$INTERVAL"
done

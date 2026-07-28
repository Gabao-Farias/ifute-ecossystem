# Task 26 — Maximizar uso da infraestrutura (cluster do core)

## Origem

Teste de carga de 2026-07-22 ([relatório](../load-test/results/RELATORIO-2026-07-22_1516Z.md))
mostrou que **o gargalo é o processo Node do `ifute-core-simple`, single-thread,
que satura ~1,2 de 4 CPUs** — Postgres (16/100 conns) e RAM (~2 GB livres) sobram.
Recomendação #1: rodar o core em múltiplos processos para usar todos os cores.

## Decisões

- **Abordagem: Node cluster in-process** (não PM2, não réplicas de container).
  Menor diff, zero mudança em nginx/`release.sh`, alinhado à VPS única simples.
- **Sem Redis.** O estado em memória (rate-limit, blocklist) é mitigado sem infra
  nova (ver abaixo).

## O que foi implementado

| Arquivo | Mudança |
|---|---|
| `src/index.ts` | Cluster: primary forka N workers (socket compartilhado), respawn com guarda anti-crash-storm, shutdown gracioso |
| `src/shared/utils/cluster.ts` (novo) | `getClusterWorkers()`: `CLUSTER_WORKERS` > default (nº CPUs em prd; 1 fora de prd) |
| `src/shared/database/datasource.ts` | Pool `extra.max` por-processo via `DB_POOL_MAX` (default 10) — N × max ≤ 100 |
| `src/apps/mobile/middlewares/rateLimit.ts` | Limite dividido por nº de workers → agregado por IP ~50/min |
| `src/shared/services/blocklist/blockList.service.ts` | `startAutoRefresh()` recarrega bans do DB a cada 30s (propaga entre workers) |
| `src/bootstrap.ts` | Chama `BlockListService.startAutoRefresh()` |
| `src/shared/utils/env.ts` | Novas envs `CLUSTER_WORKERS`, `DB_POOL_MAX` |
| `ifute-compose/docker-compose.yml` | `mem_limit` do core 512m → 1g (N workers no mesmo container) |

Por que dev fica em 1 processo: evita que N workers corram as migrations de boot
em paralelo (em prd `RUN_MIGRATIONS_ON_BOOT=false`, sem race) e mantém debug simples.

## Validação local (feita)

- `tsc --noEmit` limpo.
- Cluster real (2 workers, Postgres descartável): ambos escutam na porta
  compartilhada, servem 200, rate-limit agrega ~50/min por IP, respawn e guarda
  anti-crash-storm funcionam.

## Deploy (a fazer, via ifute-compose)

1. **Versionar**: bump `ifute-core-simple/package.json` (`npm version patch --no-git-tag-version`) e commitar.
2. **Config no servidor**: em `/root/repos/ifute-compose/.env.ifute-core-simple`, definir:
   - `CLUSTER_WORKERS=3` (VPS tem 4 cores; deixa 1 para Postgres/nginx/jobber — ajustável)
   - `DB_POOL_MAX=10` (3 × 10 = 30 conns, folgado sob os 100 do Postgres)
3. **Release**: `./scripts/release.sh ifute-core-simple` (builda amd64, recria o core, reload nginx).
4. **Validar**: logs mostram "forking 3 workers" + 3 "listening"; `docker stats` do core deve passar de ~130% para perto de 300%+ sob carga.
5. **Re-rodar o teste de carga** (`load-test/`) para medir o novo teto e comparar.

## Resultado (deployado 2026-07-22 — 0.3.3, 3 workers)

Deploy concluído: `CLUSTER_WORKERS=3`, `DB_POOL_MAX=10`, `mem_limit=1g`.
Re-teste de carga (mesmo método do baseline) confirmou a melhoria:

| Métrica | Baseline (1 proc) | Cluster (3 workers) |
|---|---|---|
| Throughput útil | ~77 req/s | **~146 req/s** (+90%) |
| p95 latência | 19,4 s | **5,6 s** (−71%) |
| Falhas | 37% | **20%** |
| CPU do core | ~1,2 core | **~2,4 cores** |

**Novo gargalo: CPU do Postgres** (query geo do `discover` satura ~1 core) +
saturação do box (load ~8/4 cores). NÃO é conexões (36/100) nem RAM.

## Próxima alavanca

Não são mais workers — o limite virou **CPU de query**. Prioridade agora:
**cache de leitura** (`discover`/detalhes, recomendação #4/#6 do baseline) e
otimizar a query. Comparativo completo:
[`load-test/results/RELATORIO-cluster-2026-07-22_2025Z.md`](../load-test/results/RELATORIO-cluster-2026-07-22_2025Z.md).

## Capacidade em nº de usuários

Para traduzir o teto de throughput (req/s) em usuários suportados, ver o perfil
de uso real derivado de sessão do app em
[`load-test/usage-profile.md`](../load-test/usage-profile.md): **~0,29 req/s por
usuário ativo** → cluster comporta ~**500–700 usuários em uso contínuo**
(alguns milhares com o padrão real rajada+pausa).

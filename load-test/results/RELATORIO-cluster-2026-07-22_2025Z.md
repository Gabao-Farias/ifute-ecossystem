# Teste de Carga — Pós-cluster (task 26) — Comparativo

**Data:** 2026-07-22 · **Alvo:** `https://api.ifute.com.br` (produção)
**Build testado:** `ifute-core-simple` cluster **3 workers** (`CLUSTER_WORKERS=3`, `DB_POOL_MAX=10`, `mem_limit=1g`)
**Método:** idêntico ao baseline (k6 `ramping-arrival-rate` até 2000 req/s, ~7,5 min, mesmos endpoints de leitura, ambas as proteções por-IP contornadas para medir capacidade agregada). Gerador no Brasil (RTT ~187 ms até a VPS OVH Canadá).

> Baseline = teste single-process de 2026-07-22 ([RELATORIO-2026-07-22_1516Z.md](RELATORIO-2026-07-22_1516Z.md), run 2). Ambos com nginx `limit_req` desabilitado e rate-limit do app contornado. Prod foi revertido ao 0.3.3 limpo após o teste.

---

## TL;DR

**O cluster funcionou: dobrou o uso de CPU pelo core (1,2 → 2,4 cores), quase dobrou o throughput útil e derrubou a latência p95 de ~19 s para ~5,6 s.** O ganho não foi 3× cheio porque o workload é pesado de banco (a query geo do `discover`) — **o novo gargalo passou a ser a CPU do Postgres** (~1 core no talo executando a query) somada à saturação geral do box (load ~8 em 4 cores).

---

## Comparativo direto

| Métrica | Baseline (1 processo) | Cluster (3 workers) | Δ |
|---|---|---|---|
| Throughput total | ~122 req/s | **~182 req/s** | **+49%** |
| Throughput com sucesso (2xx) | ~77 req/s | **~146 req/s** | **+90%** |
| Sucesso (checks) | 62,9% | **80,2%** | +17 pp |
| Falhas (`http_req_failed`) | 37,1% | **19,8%** | −47% |
| Latência mediana | 6,15 s | **4,33 s** | −30% |
| Latência p95 | 19,45 s | **5,58 s** | **−71%** |
| Latência p99 | 60 s (timeout) | **6,52 s** | −89% |

### Uso da infra no pico

| Recurso | Baseline | Cluster | Leitura |
|---|---|---|---|
| CPU do core (container) | ~134% (~1,2 core) | **~245% (~2,4 cores)** | cluster usa mais cores ✅ |
| CPU do Postgres | ~45% | **~100% (1 core no talo)** | **novo gargalo** |
| Conexões Postgres | 16 / 100 | **36 / 100** | ainda com folga |
| Load do host (1 min) | ~3,5 | **~8** | box saturado (4 cores) |
| RAM livre | ~2,0 GB | ~0,9 GB | ok (core em ~26% de 1g) |

---

## Análise

- **A melhoria é real e na direção certa.** Antes, 1 processo Node saturava ~1 core e a latência colapsava para dezenas de segundos. Com 3 workers, o core passa a usar ~2,4 cores, atende ~2× mais requests com sucesso e mantém p95 em ~5,6 s mesmo sob carga extrema (2000 req/s ofertados).
- **Por que não 3× cheio:** o endpoint mais pesado (`discover`) faz uma query geo cara. Com 3 workers empurrando queries concorrentes, o **Postgres passou a ~100% de CPU** — e uma query é single-threaded, então ela satura 1 core. Somado ao core (~2,4 cores) e ao SO, o host chega a load ~8 (4 cores), ou seja, **CPU do box + custo da query viraram o teto**, não mais o Node sozinho.
- **Conexões e RAM seguem sobrando** (36/100 conns; core em ~26% de 1g). O gargalo é **CPU** (query do Postgres + saturação do host), não pool nem memória.

## Próximas alavancas (ordem de impacto)

1. **Cache de leitura** (recomendação #4/#6 do baseline): `discover`/detalhes de place mudam pouco. Cache HTTP/CDN ou cache curto em memória tira a query geo do caminho quente → alívio direto no gargalo atual (CPU do Postgres). Provável maior ganho por esforço agora.
2. **Otimizar a query do `discover`** (índices geoespaciais, reduzir trabalho por request).
3. Só depois, avaliar mais workers/RAM — hoje não adianta, o limite é CPU de query, não de processos Node.

## Estado de produção pós-teste (verificado)

- `ifute-core-simple` **0.3.3** (cluster, 3 workers), health 200.
- `CLUSTER_WORKERS=3`, `DB_POOL_MAX=10`, `mem_limit=1g` — **permanentes**.
- Temporários do teste **revertidos**: `RATE_LIMIT_BYPASS_TOKEN` removido, nginx `limit_req` (10 r/s/IP) reativado (confirmado com 503 sob burst). Imagem 0.3.4 (com bypass) foi descartável e não está em uso.
- Working tree limpo (0.3.3 = git main).

_Saída bruta do k6: [loadtest-2026-07-22_202504Z.md](loadtest-2026-07-22_202504Z.md) / `.json`._

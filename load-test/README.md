# Teste de carga — iFute (Caminho A: leitura)

Kit para medir o **teto de capacidade da infra atual** (VPS única) pelos
endpoints de leitura do app mobile — a fatia dominante do tráfego real. Não toca
Asaas, não escreve no banco.

> **Fora de escopo aqui:** o caminho de escrita/pagamento (`order` → `confirm`)
> dispara cobrança real no Asaas e **nunca** deve ser exercido contra a chave de
> produção. Esse fluxo se testa em local/homolog com a chave sandbox
> (`$aact_hmlg_...`). Ver "Caminho B" no fim.

## Arquivos

| Arquivo | O que é |
|---|---|
| `read-path.js` | Script k6 — rampa de req/s até saturar, mix ponderado dos 4 endpoints de leitura |
| `monitor-host.sh` | Coletor de CPU/mem/Docker/Postgres, roda na VPS via SSH em paralelo |
| `usage-profile.md` | Perfil de uso real por usuário (req/s por usuário) — base para traduzir throughput em nº de usuários suportados |

## Por que não dá pra só "mandar k6 na prod"

Duas proteções barram um teste ingênuo — e se você não lidar com elas, mede a
proteção em vez da infra:

1. **Rate limit global: 50 req/min por IP** ([rateLimit.ts](../ifute-core-simple/src/apps/mobile/middlewares/rateLimit.ts)),
   vale até pro `discover` público. O gerador vem de 1 IP → satura o limiter em ~1s.
2. **Blocklist em memória**: 3 strikes em rotas sensíveis em 1h → IP banido 24h
   ([suspiciousRoutes.ts](../ifute-core-simple/src/shared/middlewares/suspiciousRoutes.ts)).
   Whitelist via env `WHITELIST_IPS`.

### Preparação obrigatória (reversível)

**1. Isentar o IP do gerador da blocklist** — adicione o IP público da máquina
que roda o k6 ao `WHITELIST_IPS` no `.env` do core e recrie o serviço.

**2. Furar o rate limit via header secreto** — patch mínimo, guardado por env
(inerte enquanto `RATE_LIMIT_BYPASS_TOKEN` estiver vazia, ou seja, o
comportamento de prod não muda até você setar a env na janela de teste):

```diff
--- a/ifute-core-simple/src/apps/mobile/middlewares/rateLimit.ts
+++ b/ifute-core-simple/src/apps/mobile/middlewares/rateLimit.ts
@@
 import { rateLimit } from "express-rate-limit";
+import { ENV } from "../../../shared/utils/ENV"; // ajuste o import ao helper de env do projeto

 /**
  * Rate limiting applyed to all routes on application.
  */
 export const mobileGlobalRateLimit = rateLimit({
   windowMs: 60 * 1000,
   limit: 50,
   message: "You have exceeded your quota of request per minute.",
   standardHeaders: true,
+  // Bypass temporário para testes de carga controlados. Inerte em prod:
+  // só pula o limite quando a env estiver setada E o header casar.
+  skip: (req) => {
+    const token = ENV.RATE_LIMIT_BYPASS_TOKEN;
+    return !!token && req.header("x-loadtest-bypass") === token;
+  },
 });
```

Depois: setar `RATE_LIMIT_BYPASS_TOKEN=<segredo-forte>` no `.env`, releasar o
core (`./scripts/release.sh ifute-core-simple` a partir de `ifute-compose/`),
e passar o **mesmo** segredo pro k6 via `BYPASS_TOKEN`.

**3. Reverter após o teste** — remover a env `RATE_LIMIT_BYPASS_TOKEN` (o `skip`
volta a ser no-op mesmo com o código presente) e tirar o IP do `WHITELIST_IPS`.
Idealmente reverter o patch também no próximo release.

> Não há `/health`. O k6 usa os próprios 2xx dos endpoints como sinal de saúde.

## Rodando

**Na VPS** (SSH, sessão 1) — coletor de métricas:

```bash
./monitor-host.sh <nome-do-container-postgres> 5 | tee monitor-$(date +%s).log
```

**Na máquina do gerador** (sessão 2) — k6 ([instalar](https://grafana.com/docs/k6/latest/set-up/install-k6/)).
Rode **de dentro de `load-test/`** (o report é escrito em `results/` relativo ao cwd):

```bash
cd load-test
BASE_URL=https://api.ifute.com.br \
PLACE_ID=<uuid-de-place-de-teste-no-atlantico> \
JWT=<token-mobile-de-teste> \
BYPASS_TOKEN=<mesmo-RATE_LIMIT_BYPASS_TOKEN> \
PEAK_RPS=300 \
k6 run read-path.js
```

Ao terminar, o próprio k6 gera **`results/loadtest-<data>_<hora>Z.md`** (relatório
legível) e **`.json`** (dados brutos) — é o "diretório novo com arquivos por
data/hora". A tabela de correlação com o host fica pra preencher com o
`monitor-*.log`; me mande os dois e eu fecho a leitura/conclusão.

- `PLACE_ID`: um place de teste real (coords no Atlântico). Sem ele, o mix pula
  o endpoint de detalhes.
- `JWT`: token mobile (`npm run tools:testjwt` no core, ou `AUTHORIZED_TEST_TOKEN`
  do `.env`). Sem ele, pula o `cost-breakdown` (único privado do mix).
- `PEAK_RPS`: comece em 300; se os thresholds aguentarem folgado, suba e repita.

## Lendo o resultado

O executor `ramping-arrival-rate` empurra a taxa-alvo independente da latência.
O **teto de capacidade** é o ponto onde, ao subir o alvo de req/s:

- `http_req_failed` passa de ~1%, **ou**
- `http_req_duration` p95/p99 dispara (thresholds no script), **ou**
- a taxa observada (`http_reqs`) para de acompanhar o alvo — k6 avisa
  `Insufficient VUs`, sinal de que cada request está lenta demais pra sustentar o rate.

Cruze esse instante com o `monitor-host.log`. Hipótese a validar: **o Postgres
(conexões ativas vs `max_connections`, ou o pool do TypeORM) satura antes da
CPU**. Se `pg: conns` encostar no teto ou `oldest_active_query` crescer, o gargalo
é banco — e a alavanca é tuning de pool/`max_connections`/índices, não mais CPU.

## Caminho B (escrita/pagamento) — só local/homolog

Fluxo completo de `order` valida concorrência (lock de horário, double-booking)
e a latência que o Asaas injeta, sem risco financeiro:

```bash
# no ifute-core-simple/
npm run containers:dev   # sobe app + postgres com NODE_ENV=lcl e Asaas sandbox
npm run db:reset && npm run tools:dataset   # seed: place + courts + users
```

Aponte um k6 análogo para `POST /mobile/private/payment/order` → `/confirm`. Mede
seu throughput de criação de order e expõe contenção de lock — **não** o
throughput absoluto de pagamento (latência do sandbox ≠ prod).

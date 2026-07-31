# Task 27 — Cache e performance de leitura (app + borda + query)

## Origem

A [task 26](task26.md) colocou o core em cluster (3 workers) e dobrou o throughput
(~77 → ~146 req/s), mas mudou o gargalo de lugar: **saiu do Node e foi para a CPU do
Postgres**, saturada pela query geo do `discover`. A própria task 26 aponta a próxima
alavanca: **cache de leitura + otimização da query**.

Esta task organiza esse trabalho junto com uma auditoria feita no app mobile e na borda
(nginx), que revelou ganhos grandes e baratos ainda não colhidos — vários deles fora do
backend.

## Diagnóstico (auditoria de 2026-07-28)

Achados que definem a prioridade dos itens abaixo:

1. **Imagens são servidas sem cache algum.**
   [`imagesRouter` público](../ifute-core-simple/src/apps/image/routes/public/index.ts)
   chama `express.static(PATH)` sem `maxAge`, então a resposta sai com
   `Cache-Control: public, max-age=0`. Resultado: **toda abertura do app revalida cada
   imagem** (round-trip nginx → Node, mesmo terminando em 304). O RN respeita o header,
   então qualquer cache no app fica pela metade enquanto isso não muda.

   O nome do arquivo salvo já é `randomUUID() + extensão`
   ([`savePlacePublicImages`](../ifute-core-simple/src/apps/backoffice/handlers/place.ts)),
   isto é, **imutável por construção** — trocar a logo gera outro nome. Isso libera
   `max-age=1y, immutable` sem risco de servir imagem velha.

2. **Não existe compressão em lugar nenhum.** Nem `compression` no Express, nem `gzip` no
   [`nginx/conf.d/default.conf`](../ifute-compose/nginx/conf.d/default.conf). E os
   payloads de leitura são grandes (ver item 3).

3. **`place?place_id=` devolve muito mais do que precisa.** A query traz **todos os
   appointments de todas as quadras, sem filtro de data** — o recorte por dia é feito em
   JS depois (`filterPlacesAppointmentsByDate`), em
   [`getAllPlaceData`](../ifute-core-simple/src/apps/mobile/services/place.service.ts).
   Isso **cresce indefinidamente** com o histórico de agendamentos: hoje é aceitável,
   daqui a um ano degrada sozinho, sem nenhuma mudança de tráfego.

4. **`discover` é caríssimo para o que devolve.** Carrega N places com todos os
   appointments + reviews + availability, filtra em JS e no fim **sorteia 3**
   (`getCityPlacesSuggestions`). Além disso a query geo
   ([`getPlacesWithinDistanceRangeKmFromPosition`](../ifute-core-simple/src/apps/mobile/utils/helpers/query.ts))
   faz haversine em **seq scan** sobre `place_location` e **calcula a distância duas
   vezes por linha** (uma no `SELECT`, outra no `WHERE`). É esta query que satura ~1 core
   do Postgres sob carga.

5. **O app refetcha muito mais do que precisa.** Da sessão real medida em
   [`load-test/usage-profile.md`](../load-test/usage-profile.md) (24 reqs em 82 s):
   - `businessConfig` — **3 chamadas**: uma no boot
     ([`BusinessConfigContext`](../ifute/src/contexts/BusinessConfigContext.tsx)) e uma a
     cada abertura de Place ([`views/Place/index.tsx`](../ifute/src/views/Place/index.tsx)).
     É um dado que muda raramente.
   - `favorites` — **4 chamadas**; `appointmentOrders` — **4 chamadas**.
   - A Home refetcha `discover` + `recents` em **todo mount** e em toda mudança de
     `day`/`locationSet` ([`views/Home/index.tsx`](../ifute/src/views/Home/index.tsx)),
     sem nenhuma noção de "ainda está fresco".
   - As rajadas de 3–5 reqs por tela não têm dedupe de request in-flight.

6. **Imagens não são redimensionadas no upload** (sem `sharp`/`jimp` nas dependências do
   core). O que o gestor sobe pelo backoffice é servido cru — foto de celular de vários MB
   renderizada num card de ~100 px. Pesa na rede, na memória do app e no disco do cache.

## Regra desta task: nenhum ajuste entra sem medição

**Requisito do solicitante:** cada ajuste precisa passar por teste de carga, para garantir
que não introduziu regressão de performance. Isso é obrigatório e vale para todas as fases.

Mas o kit atual **não pode ser usado como está** para isso — ver
[Protocolo de medição](#protocolo-de-medição) logo abaixo. O teste de teto de hoje
([RUN-PROD.md](../load-test/RUN-PROD.md)) exige patch de bypass, env nova em prod, release,
janela de madrugada e ~30–40 min por execução, e perto da saturação o resultado tem ruído
de ±10% — uma regressão de 5% não sairia do ruído. Por isso o protocolo é **em três níveis**,
e a **Fase 0 (instrumentação) é pré-requisito de todas as outras**.

## Protocolo de medição

### Nível A — micro-benchmark local (gate por commit, obrigatório)

O verdadeiro portão de regressão. Roda contra Postgres em Docker com dataset semeado,
**taxa fixa** (`constant-arrival-rate`, ex. 50 req/s por 60 s) bem abaixo da saturação —
é nesse regime que p50/p95 são estáveis e comparáveis entre duas execuções.

- Sem prod, sem bypass, sem janela de madrugada → cabe em cada commit.
- Compara: **p50, p95, bytes/resposta, nº de queries por request, CPU do processo**.
- Critério de aprovação: nenhuma métrica pior que a baseline além da margem de ruído
  (definir a margem medindo a baseline 3× — provavelmente ~5%).
- Para as mudanças de query (Fase 4), somar `EXPLAIN (ANALYZE, BUFFERS)` antes/depois:
  é evidência determinística, não estatística.

### Nível B — smoke de prod pós-deploy (por fase, ~5 min)

Confirma que o que foi medido local se sustenta com o dado e a rede reais.

- **Taxa fixa e segura**, bem abaixo do teto conhecido (~30–50 req/s contra os ~146 req/s
  medidos) — o objetivo é comparar latência e bytes, **não** saturar a VPS.
- Roda logo após o deploy da fase, em horário de baixo tráfego (não precisa madrugada).
- Verificação de headers junto: `Content-Encoding`, `Cache-Control`.

### Nível C — teste de teto completo (por marco, não por ajuste)

O teste de saturação atual, com rampa até o pico. Só ao **fechar um grupo de fases**
(ex.: fim da Fase 1+2, fim da Fase 3+4), porque é o único que atualiza o número de
capacidade e ele degrada a produção enquanto roda.

- Compara contra [`RELATORIO-cluster-2026-07-22_2025Z.md`](../load-test/results/RELATORIO-cluster-2026-07-22_2025Z.md).
- Exige o ritual completo do [RUN-PROD.md](../load-test/RUN-PROD.md), **incluindo a
  reversão** do `RATE_LIMIT_BYPASS_TOKEN` e do `WHITELIST_IPS` ao final.

### Qual nível se aplica a cada fase

| Fase | A (local) | B (smoke prod) | C (teto) | Métrica que de fato prova a fase |
|---|---|---|---|---|
| 1 — borda/headers | ✅ | ✅ | — | **bytes/resposta** e `Cache-Control`. Latência p95 do gerador mal se move (RTT de 187 ms domina) — julgar por bytes, não por p95 |
| 2 — cache no app | ⚠️ não se aplica | ⚠️ não se aplica | — | **req/s por usuário** de uma sessão real recapturada, comparada às 24 reqs/82 s de [`usage-profile.md`](../load-test/usage-profile.md). O k6 tem mix fixo: nenhuma mudança no app aparece nele |
| 3 — cache no backend | ✅ | ✅ | ✅ | **hit ratio do cache + CPU do Postgres**. Exige coordenadas variadas (ver Fase 0.2), senão o número é falso |
| 4 — queries | ✅ + `EXPLAIN` | ✅ | ✅ | **CPU do Postgres** e tempo da query. É a fase que ataca o gargalo declarado |
| 5 — thumbnails | ✅ | ✅ | — | bytes/imagem e memória do app |

> **Armadilha registrada:** medir a Fase 2 com k6 e concluir "não melhorou nada" seria
> leitura errada do instrumento — o k6 não simula o app. Do mesmo modo, medir a Fase 3 com
> a coordenada única de hoje daria um ganho fictício.

## Escopo — itens priorizados

Ordenados por **ganho ÷ esforço**. Cada fase é independente e deployável sozinha.

### Fase 0 — Instrumentação de medição (pré-requisito, bloqueia as demais)

Sem isto não existe gate de regressão confiável. É a primeira coisa a fazer.

| # | Item | Onde | Por quê |
|---|---|---|---|
| 0.1 | **Perfil de taxa fixa** no k6 (`constant-arrival-rate`, `RATE` e `DURATION` por env), coexistindo com a rampa atual via `SCENARIO=ramp\|steady` | [`load-test/read-path.js`](../load-test/read-path.js) | O executor de hoje é só `ramping-arrival-rate` até 2000 req/s — mede teto, não regressão |
| 0.2 | **Variar coordenadas e `place_id`** por iteração (lista de coords de teste no Atlântico + spread realista) | `read-path.js` (hoje `LAT`/`LON` são constantes únicas) | Sem isso, qualquer cache com chave geográfica mostra hit ratio irreal e o resultado da Fase 3 é fictício |
| 0.3 | **Métrica de bytes por endpoint** (`Trend` alimentada por `res.body.length` / `data_received`) | `read-path.js` | É a métrica que prova a Fase 1 (gzip). Hoje o script não reporta bytes |
| 0.4 | **Seed de dataset realista** para o Postgres local (places, quadras, appointments com volume comparável ao de prod) | `ifute-core-simple` (`docker-compose.yml` local já existe; não há `seed` hoje) | Sem volume realista, o Nível A não reproduz o comportamento que importa — inclusive o crescimento de histórico do achado 3 |
| 0.5 | **Registrar contexto em cada relatório**: versão da imagem, volume de dados (contagem de appointments), perfil e taxa usados | `load-test/results/` | O banco cresce; sem isso, comparar corridas de datas diferentes engana |
| 0.6 | **Decidir a política do `RATE_LIMIT_BYPASS_TOKEN`** | `.env.ifute-core-simple` em prod | O Nível B vai rodar com frequência. Deixar a env sempre setada abre superfície de ataque (o header é o único guarda); setar/remover a cada teste custa um `deploy-prd.sh`. **Decisão pendente do solicitante** — recomendação abaixo |

Sobre 0.6, recomendação: **manter a env fora de prod** e ligá-la só nas janelas de Nível B/C
via `deploy-prd.sh` (não exige release, só recria com o `.env` novo). O bypass fura apenas
o rate limit — não autenticação — mas é exatamente a proteção que segura abuso do `discover`
público, que é o endpoint mais caro da plataforma.

### Fase 1 — Borda e headers (nenhuma mudança no app, beneficia builds já instaladas)

| # | Item | Onde | Ganho esperado |
|---|---|---|---|
| 1.1 | Ligar `gzip` (tipos JSON/JS/CSS/SVG, `gzip_min_length`, `gzip_vary`) | `ifute-compose/nginx/conf.d/` | −70~85% de bytes nas respostas de leitura; grande queda de latência percebida em 4G. Custo de CPU fica **no nginx**, não no event loop do Node |
| 1.2 | `express.static(PATH, {maxAge: '365d', immutable: true})` | `src/apps/image/routes/public/index.ts` | Fim da revalidação por abertura de app; o cache de disco de Fresco/NSURLCache passa a valer entre sessões. Seguro porque o filename é UUID (achado 1) |
| 1.3 | `Cache-Control: public, max-age=60` nas rotas `/mobile/public/*` idempotentes (`businessConfig`, `discover`) | `src/apps/mobile/routes/public/` | Deixa a stack HTTP fazer parte do trabalho, inclusive antes de o app ter TTL próprio |

> **Atenção no deploy:** mudança em nginx/`.env` usa `./scripts/deploy-prd.sh`; mudança no
> core exige bump de versão + `./scripts/release.sh ifute-core-simple`. São dois deploys
> distintos.

### Fase 2 — Cache e dedupe no app mobile

Base já disponível: **MMKV** (`services/storage.ts`) para persistência e **Redux Toolkit**
para o estado. Não introduzir React Query — o padrão do projeto é thunk dentro do slice.

| Dado | TTL | Estratégia |
|---|---|---|
| `businessConfig` | **24h** persistido em MMKV | Hidrata do MMKV no boot, revalida em background. Remove as chamadas por abertura de Place. **Corrigir também o default hardcoded** em `BusinessConfigContext` (`tax_value_per_time_block: 1.99` — o valor real é 4,99) |
| `discover` | **3–5 min**, chave `lat/lon arredondado + day` | Ciente do efeito colateral: como o backend sorteia 3 places por chamada, o cache **congela a vitrine** durante o TTL — o que é melhor de UX que a home trocar de conteúdo a cada foco |
| `favorites` / `recents` | cache local + revalidate em background | Otimista no toggle de favorito (já existe `toggleFavoriteAsync`) |
| **`place?place_id=`** | **15–30s, no máximo** | **Não cachear agressivamente**: carrega a disponibilidade de horários. Cache longo = usuário seleciona bloco já ocupado e toma erro no pagamento. Padrão correto: stale-while-revalidate — place aparece na hora, só a grade de horários com skeleton |
| `appointmentOrders` | revalidate on focus | Muda por webhook do Asaas, não dá para confiar em TTL |

Além do TTL:

- **Dedupe de request in-flight** — usar a opção `condition` do `createAsyncThunk` para
  barrar dispatch quando o status já é `loading`. Corta duplicatas das rajadas de tela
  sem nenhuma infra nova.
- **Refetch só se stale** — na Home, trocar o `useEffect` que dispara sempre por uma
  checagem de validade do cache.

Descartado nesta fase: **`If-None-Match`/304 nas respostas JSON**. Economiza bytes, mas o
Express só gera o ETag **depois** de rodar a query — não alivia a CPU do Postgres, que é o
gargalo atual. Baixa prioridade.

### Fase 3 — Cache de leitura no backend (sem Redis)

Alinhado à restrição do CLAUDE.md (nada de infra nova):

- **Cache em memória por processo** (`Map` com TTL) para `discover`, chave
  `lat/lon arredondado + day`. Com 3 workers há 3 caches independentes — aceitável para
  um dado que já é aproximado e sorteado.
- **`proxy_cache` do nginx** para `/images/public/` e micro-cache (10–60s) das rotas
  `/mobile/public/*`. Mata a maior parte do custo antes de chegar no Node.
- Avaliar **servir `/images/public/` direto do nginx** (bind-mount do volume
  `ifute-core-simple`), tirando tráfego de imagem do event loop por completo.

### Fase 4 — Raiz do gargalo: as queries

- `discover` e `getAllPlaceData`: **filtrar appointments por data no SQL**, em vez de
  trazer tudo e recortar em JS (achados 3 e 4). Ataca simultaneamente latência, payload e
  a degradação futura por crescimento de histórico.
- Query geo: **pré-filtrar por bounding box de lat/lon** (com índice B-tree) antes do
  haversine, e calcular a distância **uma vez** (CTE/subquery em vez de repetir a
  expressão no `WHERE`). Alternativa mais robusta: `cube`+`earthdistance` ou PostGIS —
  avaliar se vale a dependência.
- `discover`: parar de hidratar relações que o sorteio vai descartar — buscar as relações
  **só dos 3 places escolhidos**.

### Fase 5 — Imagens redimensionadas (maior esforço, deixar por último)

Gerar thumbnail + versão full no upload (`sharp` no core) e servir o thumbnail nos cards.
Requer migração dos arquivos já existentes no volume. Fecha a conta de banda/memória do
app, mas é o item mais invasivo — só depois que 1 a 4 estiverem medidos.

## Validação

Ordem obrigatória por ajuste, segundo o [Protocolo de medição](#protocolo-de-medição):

1. **Correção primeiro:** `tsc --noEmit` limpo nos repos tocados; `npm test` (Vitest) no app
   e no core. Um ajuste que quebra teste não vai para medição.
2. **Nível A (local, taxa fixa)** — comparar contra a baseline local da mesma sessão de
   trabalho, não contra número de outro dia. Se alguma métrica piorar além da margem de
   ruído, **o ajuste não avança** até ser entendido.
3. **Deploy da fase** (`deploy-prd.sh` para nginx/`.env`; bump + `release.sh` para o core).
4. **Nível B (smoke em prod)** + conferência de headers com `curl -I`
   (`Content-Encoding: gzip`, `Cache-Control: public, max-age=31536000, immutable` nas
   imagens).
5. **Nível C (teto)** só ao fechar o grupo de fases, atualizando o número de capacidade e
   um novo relatório em [`load-test/results/`](../load-test/results/).
6. **Perfil do app** (exclusivo da Fase 2): recapturar uma sessão real e comparar contra as
   24 reqs/82 s de [`usage-profile.md`](../load-test/usage-profile.md). Reduzir req/s por
   usuário eleva a capacidade em nº de usuários **sem tocar em infra** — é ganho que o
   teste de teto não enxerga.

Registrar cada corrida em `load-test/results/` com o contexto do item 0.5 (versão, volume de
dados, perfil, taxa). Se uma fase for revertida por regressão, registrar o motivo aqui na
task — o histórico de tentativas frustradas vale tanto quanto o de sucessos.

### Critério de rollback

Regressão confirmada no Nível B (fora da margem de ruído, reproduzível) → reverter a fase
antes de seguir para a próxima. Como cada fase é independente e deployável sozinha, o
rollback é: `deploy-prd.sh` com o `.env`/nginx anterior, ou `release.sh` com a tag de imagem
anterior (as imagens antigas continuam no host).

## Fora de escopo

- Redis / cache distribuído (contraria a diretriz de simplicidade do ecossistema).
- CDN externa para imagens — reavaliar só se o volume de banda justificar.
- Caminho de escrita (order → Asaas): nunca foi testado sob carga; é uma task própria.

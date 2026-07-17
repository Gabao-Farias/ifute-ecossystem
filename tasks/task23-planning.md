# Task 23 — Backoffice Mestre (diretoria iFute)

## Contexto / Motivação

A diretoria da iFute precisa de uma visão **global** do negócio — hoje o
`ifute-backoffice/` é escopado **por local** (RBAC `owner`/`maintainer`/`viewer`
via header `active-place-id`), então nenhum admin enxerga o agregado de toda a
plataforma. A Task 23 cria um **backoffice mestre** separado, de acesso total e
sem escopo de local, exclusivo para a diretoria.

**Escopo inicial (deliberadamente enxuto):**
1. **Faturamento total gerado por mês** (série temporal).
2. **Ranking dos 10 locais com maior faturamento.**

**Restrições de deploy iniciais:**
- Roda **somente em localhost**, chamando o **endpoint de produção** (`https://api.ifute.com.br`).
- Sem domínio, sem nginx, sem entrada no `release.sh` por enquanto. É uma
  ferramenta interna que a diretoria roda na própria máquina.

### Decisões fechadas com o solicitante

1. **Três métricas em ambas as telas** (por mês e por local):
   - **GMV / Volume transacionado** = `amount_charged` (total pago pelos usuários).
   - **Receita da plataforma iFute** = `tax_value_per_time_block × blocos` (a taxa da iFute).
   - **Margem líquida iFute** = ver correção abaixo.
2. **Autorização por allowlist em variável de ambiente** (não criar papel `director` no banco).

### Correção sobre "Margem líquida" (levantada na análise do código)

Na pergunta inicial, a margem líquida foi descrita como "receita da plataforma
menos taxas do Asaas (`provider_fee`) e comissão de afiliados". **Isso está
incorreto no modelo real** e foi ajustado:

- Em [`computeOrderFinancials`](../ifute-core-simple/src/apps/backoffice/services/adminUser.service.ts) o
  `net` do **admin** = `amount_charged − provider_fee − platform_tax`. Ou seja, o
  `provider_fee` (PIX-in do Asaas) é descontado do **repasse do dono da quadra**,
  **não** da iFute.
- A iFute fica com o `platform_tax` **inteiro**; dele sai apenas a **comissão do
  afiliado**.

**Fórmula correta da margem da plataforma por order:**

```
margem_iFute = platform_tax_cents − affiliate_commission_value_cents
```

O `provider_fee` **não** entra nesse cálculo (não é custo da plataforma). Ele será
exibido como **linha informativa separada** ("custo Asaas do ecossistema"), útil
para a diretoria ver quanto de PIX-in o Asaas absorveu, mas fora da margem da iFute.

> Observação: as **taxas de saque** (`withdrawal_fee_cents`, PIX-out) também não
> entram na margem — quem saca paga. Ficam fora deste dashboard inicial.

## Definições de dados (fonte da verdade)

Tudo derivado de `CourtAppointmentOrder`, usando os **snapshots** da própria order
(`business_config_at_order_time`, `amount_charged`, `provider_fee`,
`affiliate_commission_value_cents`) — números históricos nunca mudam se a config
mudar depois.

Por order (todos em **centavos**, reaproveitando a lógica de
[`computeOrderFinancials`](../ifute-core-simple/src/apps/backoffice/services/adminUser.service.ts#L363)):

| Métrica | Fórmula |
|---|---|
| **GMV** | `round(amount_charged × 100)` |
| **Receita plataforma** | `round(tax_value_per_time_block × blocos × 100)` |
| **Margem líquida iFute** | `receita_plataforma − affiliate_commission_value_cents` |
| **Custo Asaas (info)** | `round(provider_fee × 100)` |

- **Blocos** = `Σ court.newAppointments.length` via
  [`countAppointedTimeBlocks`](../ifute-core-simple/src/apps/backoffice/services/adminUser.service.ts#L341).
- **Vínculo com o local**: `order.data.placeId` (JSON, não FK). Junta-se a `Place`
  por `place_id`; o nome também está denormalizado em `order.place_details`/`place_config_at_order_time`.

### Filtros de inclusão

- **Só orders com dinheiro recebido**: `cash_capture_status = 'captured'`.
  (Exclui `waiting_payment`, `waiting_capture` e `canceled`.) Vale tanto para o
  modelo novo (saldo) quanto legado — settlement/saque não muda o fato de a
  receita ter sido gerada.
- **Base temporal**: agrupar por **`created_at`** (quando a receita foi gerada),
  convertido para **America/Sao_Paulo** antes de extrair ano-mês (o `created_at` é
  `timestamptz`/UTC — sem conversão, viradas de mês perto da meia-noite caem no mês errado).
- **Places de teste**: decidido **incluir tudo** (não filtrar). Os Places de teste
  em prod (coordenadas do Atlântico Sul `lat -54.441196`/`lon -36.554195`) entram
  no agregado como qualquer outro. (Um filtro opcional pode ser adicionado depois
  se incomodar.)

## Arquitetura

### Backend — `ifute-core-simple/` (app dedicado `backoffice-director`)

> **Decisão (revisada com o solicitante):** em vez de pendurar rotas `director`
> dentro do app `backoffice`, criar um **app novo e autocontido**
> `src/apps/backoffice-director/`, montado no `rootRouter` sob o prefixo
> `/director` — mesmo padrão de `mobile`/`backoffice`/`webhook`/`image`. Motivos:
> (1) público e regras distintos (diretoria global vs. dono de quadra por local);
> (2) **CORS próprio** — o backoffice só aceita `backoffice.ifute.com.br`, então
> um front em `localhost:7104` seria bloqueado; o app director libera
> `localhost:7104` (é uma ferramenta local batendo em prod); (3) auth isolada
> (`DIRECTOR_JWT_SECRET`), tokens não intercambiáveis com o backoffice. A
> convenção de apps + o papel de `shared/` ficaram documentados no
> [CLAUDE.md do core](../ifute-core-simple/CLAUDE.md).

Estrutura do app (autocontido, mesma convenção dos demais):

```
src/apps/backoffice-director/
  routes/       index (express.json + cors[localhost:7104] + rateLimit) · public/auth · private/{auth,reports}
  middlewares/  auth (authenticateToken via DIRECTOR_JWT_SECRET) · director (requireDirector) · rateLimit
  handlers/     auth (find-or-create AdminUser no 1º login, sem afiliação)
  services/     auth.service (googleSignIn via DIRECTOR_GOOGLE_CLIENT_ID) · director.service (agregação)
  utils/        security/jwt · constants/jwt
```

**Auth própria (isolada):** `authenticateToken` verifica `DIRECTOR_JWT_SECRET`;
`googleSignIn` valida o token Google contra `DIRECTOR_GOOGLE_CLIENT_ID` (pode ser
o mesmo Google client do backoffice — só autorizar a origem `localhost:7104`).

**`requireDirector`** (`middlewares/director.ts`): roda depois de
`authenticateToken`, lê `req.user.sub` (o JWT só carrega `sub`) e compara com a
allowlist `ENV.DIRECTOR_ADMIN_IDS` (UUIDs por vírgula). Fora da lista → `403`.
Sem lookup no banco, sem papel novo no DB. Aplicado a **todas** as rotas
`/director/private` (inclusive `/login/check`).

**Envs novas** em [`env.ts`](../ifute-core-simple/src/shared/utils/env.ts) +
`.env.sample`: `DIRECTOR_JWT_SECRET`, `DIRECTOR_GOOGLE_CLIENT_ID`,
`DIRECTOR_ADMIN_IDS`.

**Endpoints:**

1. `POST /director/public/auth/login/google` — login Google (fluxo implícito).
2. `GET  /director/private/auth/login/check` — valida sessão (passa pelo gate).
3. `GET  /director/private/reports/revenue/monthly?months=12`
   ```json
   [{ "month": "2026-07", "gmv_cents": 0, "platform_revenue_cents": 0,
      "net_margin_cents": 0, "provider_fee_cents": 0, "order_count": 0 }]
   ```
4. `GET  /director/private/reports/places/ranking?limit=10&sort=gmv|platform_revenue|net_margin&month=YYYY-MM`
   ```json
   [{ "place_id": "uuid", "place_name": "Arena X", "gmv_cents": 0,
      "platform_revenue_cents": 0, "net_margin_cents": 0,
      "provider_fee_cents": 0, "order_count": 0 }]
   ```

**Service** `services/director.service.ts`:
- Carrega orders `captured` e agrega em JS, reusando `computeOrderFinancials`
  (promovido para `shared/utils/helpers/order.ts`).
- **Por que JS e não SQL cru**: contagem de blocos e taxa vêm de JSON aninhado
  (`data.courts[].newAppointments`, `business_config_at_order_time`); reusar a
  lógica já validada evita drift/casos legados. Volume atual comporta; se crescer,
  migrar para agregação SQL/materialized view.
- Bucket de mês em `America/Sao_Paulo`. Sem filtro de Places de teste (incluir tudo).

**Helpers compartilhados:** `computeOrderFinancials` + `countAppointedTimeBlocks`
saíram de `backoffice/services/adminUser.service.ts` para
[`shared/utils/helpers/order.ts`](../ifute-core-simple/src/shared/utils/helpers/order.ts)
(agora usados por `backoffice` **e** `backoffice-director`); os consumidores
antigos (`adminUser.service`, `withdrawal.service`) passaram a importar do shared.

**Testes**: `backoffice-director/services/director.service.unit.spec.ts` (9 testes)
cobre as 3 métricas, contagem de blocos, bucket de mês com timezone, zero-fill,
ranking por métrica e filtro de mês. Suíte completa: 371/371. Wiring do app
(401 sem token, 403 fora da allowlist, 400 no login) validado via smoke test.

### Frontend — novo repo `ifute-master-backoffice/`

Novo subdiretório/repo Git independente, **clonando a stack** do
`ifute-backoffice/` (React 19 + Vite + TS + Tailwind v4 + shadcn/ui + TanStack
Query + Zustand + login Google), mas **enxuto**:

- **Sem** `active-place-store` nem header `active-place-id` (não há escopo de local).
- **Sem** os módulos de place/finance/affiliate/withdrawal — só o dashboard mestre.
- Reaproveita: `client.ts` (axios + interceptor de auth 401), `use-auth.ts`,
  `auth-store.ts`, `protected-route.tsx`, `theme-*`, `index.css` (tokens de marca),
  `lib/format.ts` (`brlFromCents`).

**Estrutura mínima:**
```
src/
  api/            client.ts, auth.ts, director.ts
  pages/          login.tsx, dashboard.tsx
  components/     ui/ (subset shadcn), layout/, charts/
  hooks/          use-auth.ts
  store/          auth-store.ts, theme-store.ts
  lib/            env.ts, format.ts, query-client.ts
  routes/         index.tsx, protected-route.tsx
```

**Telas:**
- **Login**: mesmo fluxo Google OAuth. Se o admin logado não estiver na allowlist,
  o backend responde `403` nas rotas `/director/*` → mostrar mensagem "acesso
  restrito à diretoria".
- **Dashboard** (página única inicial):
  - **Faturamento por mês**: gráfico de barras/linha com toggle entre as 3
    métricas (GMV / Receita / Margem) + tabela com os valores e `order_count`.
  - **Top 10 locais**: tabela ordenável pelas 3 métricas, com filtro de mês
    (ou all-time).
  - Cards de resumo no topo (total do mês corrente por métrica).

**Gráficos**: `recharts` (decidido) — leve, integra bem com shadcn/Tailwind.

**Env** (`.env.sample`): `VITE_API_URL=https://api.ifute.com.br/backoffice`,
`VITE_GOOGLE_AUTH_CLIENT_ID=<client id de prod>`. Dev server na **porta 7104**
(livre; 7100-7103 já ocupadas — só dev, sem nginx/domínio por ora).

## Sugestões (além do escopo pedido)

1. **Excluir Places de teste** do agregado (coordenadas do Atlântico Sul) — senão
   os números da diretoria vêm poluídos. Recomendo ligar por padrão, com flag para
   incluir se quiserem auditar.
2. **Cards de KPI no topo**: totais do mês corrente + variação vs. mês anterior
   (MoM %) — barato de calcular a partir da mesma série e muito útil para diretoria.
3. **Exportar CSV** do ranking/série (o `ifute-backoffice` já tem `lib/csv.ts` para copiar).
4. **Contagem de orders / ticket médio** por local — já temos `order_count`, então
   ticket médio (`gmv / orders`) sai de graça.
5. **Comissão de afiliados paga** como métrica global — a diretoria pode querer ver
   quanto está saindo em comissões (`Σ affiliate_commission_value_cents`).

## Decisões (todas fechadas)

1. **Nome do repo/pasta**: `ifute-master-backoffice/`.
2. **Lib de gráfico**: `recharts`.
3. **Places de teste**: incluir tudo (sem filtro).
4. **Base temporal**: `created_at` da order (fuso America/Sao_Paulo).
5. **Allowlist por admin_id** (`DIRECTOR_ADMIN_IDS`).
6. **Métricas**: GMV, Receita da plataforma, Margem líquida (`platform_tax − comissão_afiliado`); `provider_fee` como linha informativa.

## Status da implementação

- [x] **Backend** — app dedicado `src/apps/backoffice-director/` (routes/handlers/
  middlewares/services/utils próprios), montado em `/director` no `rootRouter`.
  Auth isolada (`DIRECTOR_JWT_SECRET`/`DIRECTOR_GOOGLE_CLIENT_ID`), CORS liberando
  `localhost:7104`, `requireDirector` por `DIRECTOR_ADMIN_IDS`. Helpers financeiros
  promovidos para `shared/utils/helpers/order.ts`. **9 unit tests**; suíte 371/371;
  typecheck limpo; wiring validado por smoke test (401/403/400).
- [x] **Frontend** — repo `ifute-master-backoffice/` (React 19 + Vite + Tailwind +
  shadcn + Recharts), git independente na branch `main`, adicionado ao `.gitignore`
  do meta-repo. Aponta para `/director`. Login Google + dashboard (KPI cards com MoM,
  gráfico mensal por métrica, ranking top-10 com filtro de mês e 403 → "acesso
  restrito"). Build OK.
- [x] **Docs** — convenção de apps + papel de `shared/` documentados no
  [CLAUDE.md do core](../ifute-core-simple/CLAUDE.md).
- [ ] **Setup de acesso (pendente, requer você)**: gerar `DIRECTOR_JWT_SECRET`;
  cada diretor loga uma vez → capturar o `admin_id` → popular `DIRECTOR_ADMIN_IDS`
  no `.env` de prod → **release do core** (`ifute-compose/scripts/release.sh
  ifute-core-simple`, com bump de versão antes). Sem esse release em prod, o app
  `/director` não existe ainda no backend que o front consome. No front: preencher
  `VITE_GOOGLE_AUTH_CLIENT_ID` e autorizar a origem `http://localhost:7104` no
  Google Cloud.

## Arquivos-chave (referência)

| Papel | Caminho |
|---|---|
| App novo (diretoria) | `ifute-core-simple/src/apps/backoffice-director/` |
| Cálculo financeiro por order (compartilhado) | `ifute-core-simple/src/shared/utils/helpers/order.ts` (`computeOrderFinancials`, `countAppointedTimeBlocks`) |
| Agregação dos relatórios | `ifute-core-simple/src/apps/backoffice-director/services/director.service.ts` |
| Gate da diretoria | `ifute-core-simple/src/apps/backoffice-director/middlewares/director.ts` |
| Montagem dos apps (prefixos) | `ifute-core-simple/src/rootRouter.ts` |
| Entidade da order | `ifute-core-simple/src/shared/database/entities/courtAppointmentOrder.entity.ts` |
| ENV (novos: `DIRECTOR_*`) | `ifute-core-simple/src/shared/utils/env.ts` |
| Frontend | `ifute-master-backoffice/` |

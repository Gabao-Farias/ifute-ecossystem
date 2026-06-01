# Task 12 — Deploy de produção (backend + backoffice + migração de banco)

> Documento de planejamento por fases. Serve de **base para execução** pelo Claude/operador.
> Decisões já tomadas (ver seção "Decisões"). Em caso de divergência com o estado real do
> servidor, **pare e confirme** antes de prosseguir — operações são sobre produção.

## Objetivo

Levar para produção a integração com Asaas já concluída, fazendo:

1. Release das imagens **`ifute-core-simple`** (backend) e **`ifute-backoffice`** (painel).
2. **Migração do banco** de `1746318492279` (estado atual em prod) até `1779000000002`
   (mais recente) — **14 migrations pendentes**, preservando os dados existentes.
3. Validação pós-deploy.

App mobile (Expo/RN) está **fora de escopo** desta task — ver "Fora de escopo".

## Decisões

| Decisão | Escolha | Motivo |
|---|---|---|
| Estratégia de migração | **Incremental** (`migrations:run` sobre o banco real) | Auditoria confirmou que é seguro e preserva 100% dos dados (ver "Auditoria de segurança") |
| Auto-migrate no boot | **Manter** `runMigrations()` no boot + **backup antes** do release | Menos código alterado; risco de crash-loop mitigado pelo backup + verificação |
| App mobile | **Fora de escopo** (só citado) | Deploy mobile é via EAS/lojas, fluxo separado |
| Timestamp duplicado `1777600000000` | **Corrigir antes do deploy** (Fase 0) | Hardening; prod ainda não aplicou nenhuma das duas, então é seguro renumerar |

## Contexto técnico (referências de código)

- Migrations: [`ifute-core-simple/src/shared/database/migrations/`](../ifute-core-simple/src/shared/database/migrations/)
- Datasource (`synchronize: false`): [`datasource.ts`](../ifute-core-simple/src/shared/database/datasource.ts)
- Auto-migrate no boot: [`bootstrap.ts`](../ifute-core-simple/src/bootstrap.ts) → `MigrationsHandler.runMigrations()` → `datasource.runMigrations()`
- Scripts de deploy: [`ifute-compose/scripts/`](../ifute-compose/scripts/) (`release.sh`, `deploy-prd.sh`, `backup-db.sh`)
- A imagem do core inclui `src/` + devDeps (ts-node/typeorm), então `npm run migrations:run` roda dentro do container.

### Migrations pendentes (14)

| # | Migration | Natureza |
|---|---|---|
| 1 | `1750000000000-Migration` | add coluna (nullable) |
| 2 | `1750100000000-RenamePlaceBlockToCourt` | **rename** tabelas/colunas (place_block→court) |
| 3 | `1776900000000-PaymentProviderAbstraction` | drop colunas Stripe, add `provider` (default `'asaas'`), mexe em `user` |
| 4 | `1776950000000-AddProviderCardToken` | add coluna (nullable) |
| 5 | `1777000000000-AddAdminAsaasApiKey` | add coluna (nullable) |
| 6 | `1777100000000-AddPixFieldsToOrder` | add colunas (nullable) |
| 7 | `1777300000000-AdminPixKeyAndDeferredSplit` | add colunas (nullable) |
| 8 | `1777400000000-ProviderAuthDecisionLog` | createTable |
| 9 | `1777500000000-RenameTaxValueColumn` | **rename** coluna business_config |
| 10 | `1777600000000-AdminTransferAudit` | add colunas (nullable) — ⚠️ timestamp duplicado |
| 11 | `1777600000000-DropAsaasWalletId` | **drop** coluna — ⚠️ timestamp duplicado → vira `1777600000001` na Fase 0 |
| 12 | `1779000000000-AdminUserAffiliateFields` | add colunas + FK (afiliados) |
| 13 | `1779000000001-CourtAppointmentOrderAffiliateFields` | add colunas (nullable) |
| 14 | `1779000000002-BusinessConfigAffiliatePercent` | add coluna (NOT NULL **com default 20**) |

### Auditoria de segurança (por que a migração incremental preserva os dados)

- **Nenhuma coluna `NOT NULL` sem default** sobre tabela populada (`affiliate_percent` tem `default 20`; `provider` tem `default 'asaas'`).
- **Renames preservam dados** (place_block→court; tax_value_per_hour→tax_value_per_time_block).
- **Drops** removem apenas colunas Stripe/wallet — não tabelas de negócio.
- **Sem backfill** (`UPDATE`/`INSERT`) e **sem constraint única** sobre dado existente que possa falhar (`referral_code` é nullable; múltiplos NULL são permitidos no Postgres).
- Tabela **`user`**: perde só `stripe_customer_id` e ganha `cpf_cnpj` (nullable) → **linhas preservadas**. Tabelas-filhas (favorites, recents, reports, fcm_tokens, appointments) intactas.

---

## Fases

### Fase 0 — Hardening pré-deploy (no repo, antes de tocar produção)

**Objetivo:** corrigir dívidas que poderiam atrapalhar a migração.

1. Renumerar a migration `1777600000000-DropAsaasWalletId` → `1777600000001-DropAsaasWalletId`
   (arquivo + nome da classe `DropAsaasWalletId1777600000001`), eliminando o timestamp duplicado
   com `AdminTransferAudit`.
2. Rodar a suíte local de migração para garantir que ainda sobe do zero:
   ```sh
   cd ifute-core-simple && npm run db:reset
   ```
3. Commit no `ifute-core-simple`.

**Verificação:** `npm run db:reset` conclui sem erro; `ls migrations/` não tem timestamps duplicados.

---

### Fase 1 — Pré-requisitos / infra

**Objetivo:** garantir que o ambiente local consegue fazer deploy.

1. Recriar localmente em `ifute-compose/` (estão no `.gitignore`):
   - `.env`
   - `.env.ifute-core-simple`
   - `.env.ifute-jobber`
2. Confirmar acesso SSH:
   ```sh
   ssh -p 51765 root@api.ifute.com.br true && echo OK
   ```
3. Confirmar que a stack atual está rodando no servidor e qual a migration corrente:
   ```sh
   ssh -p 51765 root@api.ifute.com.br \
     'cd /root/repos/ifute-compose && docker compose exec -T postgresdb \
       sh -c '"'"'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 5;"'"'"''
   ```
4. Ferramentas locais: `jq`, `docker`, `rsync`, `ssh` no PATH; daemon do Docker de pé.

**Verificação:** SSH OK; a última migration listada é `1746318492279-Migration` (confirma o gap esperado).

> ⚠️ Se a última migration **não** for `1746318492279`, **pare** — o plano assume esse ponto de partida.

---

### Fase 2 — Backup do banco (obrigatório, imediatamente antes do deploy)

**Objetivo:** ponto de restauração antes de qualquer alteração de schema.

1. Garantir que `backup-db.sh` está instalado no servidor (senão copiar de `scripts/`).
2. Executar backup on-demand e **baixar uma cópia para fora da VPS**:
   ```sh
   ssh -p 51765 root@api.ifute.com.br '/root/backup-db.sh'
   # copiar o dump mais recente para a máquina local:
   rsync -avz -e "ssh -p 51765" \
     root@api.ifute.com.br:/root/backups/ ./backups-prd/
   ```

**Verificação:** existe um `ifute-AAAAMMDD-HHMMSS.sql.gz` **não vazio**, recém-criado, e há cópia local.

> Sem backup válido, **não prosseguir**. As Fases 3–4 alteram o schema (renames/drops).

---

### Fase 3 — Release das imagens (backend + backoffice)

**Objetivo:** publicar as novas imagens. ⚠️ Ao subir o core, o boot roda as 14 migrations
automaticamente (decisão "manter boot"). Por isso o backup da Fase 2 é pré-condição.

1. (Se houve mudança em compose/nginx/env) enviar config primeiro:
   ```sh
   cd ifute-compose && ./scripts/deploy-prd.sh
   ```
2. Release das imagens:
   ```sh
   cd ifute-compose && ./scripts/release.sh ifute-core-simple ifute-backoffice
   ```

**Verificação:**
- `release.sh` conclui sem erro.
- O core sobe **healthy** e os logs mostram `Running migrations...` → `Migrations run finish!`
  (sem crash-loop):
  ```sh
  ssh -p 51765 root@api.ifute.com.br \
    'cd /root/repos/ifute-compose && docker compose logs --tail=80 ifute-core-simple'
  ```

> 🔥 **Rollback se o core entrar em crash-loop (migração falhou):**
> 1. Restaurar o dump da Fase 2 (ver "Rollback").
> 2. Voltar a imagem anterior (`IFUTE_CORE_SIMPLE_TAG` anterior no `.env` + `deploy-prd.sh`).
> 3. Investigar a migration que falhou antes de tentar de novo.

---

### Fase 4 — Verificação da migração

**Objetivo:** confirmar que o banco chegou a `1779000000002` com dados preservados.

1. Conferir migrations aplicadas:
   ```sh
   ssh -p 51765 root@api.ifute.com.br \
     'cd /root/repos/ifute-compose && docker compose exec -T postgresdb \
       sh -c '"'"'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 5;"'"'"''
   ```
   Esperado: topo = `BusinessConfigAffiliatePercent1779000000002`.
2. Conferir preservação de dados:
   ```sh
   # contagem de usuários deve bater com o pré-deploy
   ... -c "SELECT count(*) FROM \"user\";"
   # tabelas renomeadas existem
   ... -c "SELECT count(*) FROM court;"
   ```

**Verificação:** migration topo correta; `count(user)` igual ao de antes; tabela `court` existe.

> Caso o operador queira um passo de migração **manual/controlado** (fora do boot), o comando é:
> ```sh
> ssh -p 51765 root@api.ifute.com.br \
>   'cd /root/repos/ifute-compose && docker compose exec ifute-core-simple npm run migrations:run'
> ```
> Idempotente: se o boot já aplicou tudo, não faz nada.

---

### Fase 5 — Smoke test pós-deploy

**Objetivo:** validar o sistema ponta a ponta em produção.

- [ ] `https://api.ifute.com.br` responde (health/listagem pública)
- [ ] Login no backoffice (`https://backoffice.ifute.com.br`)
- [ ] Listagem de quadras (rota renomeada court) funciona
- [ ] Fluxo de criação de order + PIX (Asaas) gera cobrança
- [ ] Aba de afiliados (`/dashboard/affiliates`) carrega
- [ ] `ifute-jobber` rodando (crons de fatura/cancelamento)

---

## Rollback (resumo)

1. **Banco:** restaurar o dump da Fase 2:
   ```sh
   gunzip -c /root/backups/ifute-XXXX.sql.gz | \
     docker compose -f /root/repos/ifute-compose/docker-compose.yml \
       exec -T postgresdb sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
   ```
2. **Imagens:** reverter `*_TAG` no `.env` para a versão anterior e `./scripts/deploy-prd.sh`.
3. Investigar a causa antes de retentar.

---

## Fora de escopo (follow-ups)

- **Deploy do app mobile** (Expo/RN): build/publicação via EAS e lojas — fluxo separado, não coberto
  por `release.sh` (apps válidos: core, backoffice, jobber, docs, landing).
- **Endpoint `/health` no core** para que backoffice/jobber/nginx esperem o backend ficar *healthy*
  (hoje só esperam *iniciar*) — ver README do compose.
- (Opcional) Separar o auto-migrate do boot e migrar só via script dedicado, se no futuro
  quiser desacoplar deploy de migração.

---

## Itens a criar/decidir durante a execução

- [ ] (Opcional) `ifute-compose/scripts/migrate-prd.sh`: backup → `migrations:run` → verificação,
      como wrapper único do passo manual da Fase 4. Útil para futuras migrações controladas.

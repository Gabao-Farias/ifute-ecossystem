# Task 18 — Ledger de saldo + saque sob demanda

## Contexto / Motivação

O Asaas passará a cobrar uma **taxa de PIX out de R$ 2,00** por transferência. Hoje o
cron `collect_cash` Fase 2 dispara **um PIX out por order** assim que ela passa da
janela de cancelamento — uma perna para o admin da quadra (`asaas_pix_key`) e outra
para a comissão do padrinho (`affiliate_pix_key`). Com a nova taxa, isso multiplicaria
custo por order e por perna, saindo do bolso da plataforma.

**Solução:** parar de transferir automaticamente por order. Em vez disso, **acumular
saldo** (ledger) por admin e mover o repasse para um **saque sob demanda** no backoffice.
Cada saque é **um** PIX out, e a taxa de saque é **descontada do valor sacado** — quem
saca paga. Ex.: saldo de R$ 10,00 → admin recebe R$ 8,00 (taxa R$ 2,00).

### Decisões fechadas com o solicitante

1. **Dois saldos separados por admin**, cada um com seu próprio saque e sua própria taxa:
   - **Saldo de quadra** (ganhos das quadras) → saca para `asaas_pix_key`
   - **Saldo de comissão** (afiliação/padrinho) → saca para `affiliate_pix_key`
   - Preserva a chave PIX dedicada de afiliação (decisão de produto já documentada).
2. **A taxa é descontada do valor sacado** (quem saca paga). Admin recebe `saldo − taxa`.
3. **A taxa é configurável no banco** (`BusinessConfig`), com **snapshot na hora do saque**.
4. **Saque do saldo total disponível** (não valor parcial) — uma taxa por saque, ledger e UI simples.
5. **Mínimo de saque = saldo precisa ser maior que a taxa** (senão o líquido seria ≤ 0).
6. **Janela de cancelamento inalterada:** o saldo só fica disponível depois que a order
   passou da janela (mesma elegibilidade da Fase 2 atual) — mantém a solvência de estornos.

### Distinção de taxas — PIX IN vs. PIX OUT (importante, não confundir)

São **duas taxas do Asaas, em direções opostas e independentes**:

| Taxa | Direção | Quando ocorre | Valor | Quem absorve |
|---|---|---|---|---|
| **PIX IN** (`provider_fees.asaas.pix.fixed`) | dinheiro **entra** na master | cobrança paga pelo cliente final no agendamento | ~R$ 1,99 | embutida no preço ao cliente (fluxo de cobrança já existente) |
| **PIX OUT / saque** (`withdrawal_fee_cents`) | dinheiro **sai** da master | admin/padrinho faz um saque do saldo | R$ 2,00 | **o admin que saca** (descontada do valor sacado) |

A taxa de saque **não tem relação** com a tarifa de PIX IN. Não há "absorção parcial":
o `withdrawal_fee_cents` cobre exatamente o custo do PIX out, e quem paga é quem saca
(saldo `R$ 10,00` → recebe `R$ 8,00`). O valor fica configurável no banco
(`BusinessConfig.withdrawal_fee_cents`, default `200`) só para acompanhar reajustes
futuros da tarifa do Asaas, sem mexer em código.

---

## Arquitetura

### Fonte de verdade do saldo

Saldo **derivado** das orders (crédito) menos os saques (débito) — sem double-entry
completo, mas com tabela de saques explícita para auditoria.

```
saldo_quadra(admin)    = Σ net(order)                − Σ saque_quadra.gross_cents
saldo_comissao(admin)  = Σ commission(order)          − Σ saque_comissao.gross_cents
```

**Crédito (perna quadra)** — orders que contam:
- `place` pertence ao admin
- `cash_capture_status = 'captured'`
- `admin_settled_to_balance_at IS NOT NULL` (passou da janela → creditada)
- `admin_transferred_at IS NULL` (exclui orders já pagas pelo modelo **legado**)
- `net = amount_charged − provider_fee − (tax_value_per_time_block × blocks)` (em centavos)

**Crédito (perna comissão)** — orders que contam:
- `referrer_admin_id_at_order = admin`
- `cash_capture_status = 'captured'`
- `affiliate_settled_to_balance_at IS NOT NULL`
- `affiliate_commission_transferred_at IS NULL` (exclui legado)
- valor = `affiliate_commission_value_cents`

> **Separação legado × novo:** as colunas atuais `admin_transferred_at` /
> `affiliate_commission_transferred_at` (e os `*_provider_transfer_id`) ficam **só** nas
> orders já pagas pelo modelo antigo. No modelo novo elas **nunca** são setadas; usamos
> as novas colunas `*_settled_to_balance_at`. Assim nenhuma order é paga duas vezes na
> virada.

### Novas estruturas

**`BusinessConfig`** — nova coluna:
- `withdrawal_fee_cents` (`integer`, default `200`) — taxa de saque (PIX out) em centavos.

**`court_appointment_order`** — duas novas colunas:
- `admin_settled_to_balance_at` (`timestamptz`, nullable) — quando a order virou saldo
  de quadra sacável.
- `affiliate_settled_to_balance_at` (`timestamptz`, nullable) — idem perna comissão.

**Nova entidade `admin_withdrawal`** (tabela de débito + auditoria):

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `admin_id` | uuid (FK admin_user) | quem sacou |
| `balance_type` | text `'court' \| 'affiliate'` | qual saldo |
| `gross_cents` | integer | saldo sacado (bruto) |
| `fee_cents` | integer | taxa snapshot na hora do saque |
| `net_cents` | integer | `gross − fee` (o que chega ao admin) |
| `pix_key_at_withdrawal` | varchar | chave usada |
| `pix_key_type_at_withdrawal` | enum | tipo da chave |
| `provider_transfer_id` | varchar nullable | id do `/transfers` do Asaas |
| `status` | text `'processing' \| 'dispatched' \| 'failed'` | |
| `created_at` / `dispatched_at` | timestamptz | |

> Só saques com `status IN ('processing','dispatched')` contam como débito no saldo.
> `failed` é excluído (o transfer não saiu).

---

## Mudanças por fase

### Fase 1 — Migrations + entidades + config

1. Migration: add `withdrawal_fee_cents` em `business_config` (default 200).
2. Migration: add `admin_settled_to_balance_at` e `affiliate_settled_to_balance_at` em
   `court_appointment_order`.
3. Migration: cria tabela `admin_withdrawal` (índice em `(admin_id, balance_type, status)`).
4. Atualizar entidades: `BusinessConfig`, `CourtAppointmentOrder`, nova `AdminWithdrawal`.
5. Atualizar `DEFAULT_BUSINESS_CONFIG` com `withdrawal_fee_cents: 200`.

### Fase 2 — Cron `collect_cash`: transferir → creditar

Em [`apps/webhook/handlers/internal.ts`](../ifute-core-simple/src/apps/webhook/handlers/internal.ts):

- `runAdminTransferForSettledOrders` → **`runAdminSettlementForSettledOrders`**: para cada
  order elegível (mesma `verifyAdminTransferEligibility`, mesma janela), **não** chama
  `transferToWallet`; apenas `UPDATE ... SET admin_settled_to_balance_at = now()`. Critério
  do `find`: `cash_capture_status='captured' AND admin_settled_to_balance_at IS NULL AND
  admin_transferred_at IS NULL`. Sem lookup de chave PIX aqui (saque resolve a chave).
- `runAffiliateCommissionTransferForSettledOrders` → **`runAffiliateSettlement...`**: idem,
  seta `affiliate_settled_to_balance_at`. Remove a lógica de skip por chave PIX (não há
  transfer aqui). Os `affiliate_transfer_skipped_reason` deixam de ser usados no fluxo novo.
- Fase 1 (captura de CC) **inalterada**.
- Manter os logs de funil (`considered`/`eligible`).

### Fase 3 — Serviço de saque + saldo (backend)

Novo `WithdrawalService` (ou estender `adminUser.service.ts` / `affiliate.service.ts`):

- `getBalance(adminId, type)` → `{ available_cents, withdrawn_cents }` (queries acima).
- `requestWithdrawal(adminId, type)`:
  1. Abre transação; `SELECT ... FOR UPDATE` no `admin_user` (lock por admin) para
     serializar saques concorrentes do mesmo admin/tipo.
  2. Recalcula `available_cents`.
  3. Lê `withdrawal_fee_cents` da `BusinessConfig`.
  4. Valida `available_cents > fee_cents` (senão `400` "saldo insuficiente para cobrir a
     taxa de saque").
  5. Resolve chave PIX atual (`asaas_pix_key` p/ court, `affiliate_pix_key` p/ affiliate);
     ausente → `400`.
  6. Insere `admin_withdrawal` (`gross=available`, `fee`, `net=gross−fee`, `status='processing'`).
  7. `provider.transferToWallet({ value: net/100, destination, externalReference:
     'withdrawal-{id}', description })`.
  8. Sucesso → `status='dispatched'`, `provider_transfer_id`, `dispatched_at`. Erro →
     `status='failed'` (não conta como débito) e propaga erro.
- `listWithdrawals(adminId, type)` → histórico paginado.

### Fase 4 — Webhook de autorização do Asaas

Em [`apps/webhook/handlers/paymentAuth.ts`](../ifute-core-simple/src/apps/webhook/handlers/paymentAuth.ts):
adicionar `kind: 'withdrawal'` para `type: "TRANSFER"` com `externalReference =
'withdrawal-{id}'`. **Aprova** quando: `admin_withdrawal` existe, `status='processing'|'dispatched'`,
`value ≤ net_cents/100`. **Recusa** caso contrário (postura padrão-recusar). Idempotência
via `provider_auth_decision_log` (já existente).

### Fase 5 — Rotas + backoffice (API)

- `GET /backoffice/private/withdrawal/balance?type=court|affiliate` → saldo disponível + sacado.
- `POST /backoffice/private/withdrawal` `{ balance_type }` → executa saque.
- `GET /backoffice/private/withdrawal/history?type=...` → histórico.
- Ajustar `finance-summary`: semântica passa de `transferred/pending` para
  `available_cents` (sacável agora) / `locked_cents` (captured ainda na janela) /
  `withdrawn_cents`.

### Fase 6 — Backoffice (UI, repo `ifute-backoffice`)

- Área financeira: card de **saldo de quadra** + botão **Sacar**.
- `/dashboard/affiliates`: card de **saldo de comissão** + botão **Sacar**.
- Modal de confirmação **explícito** (requisito da task): "Será descontada uma taxa de
  **R$ X,XX** referente à taxa de saque (PIX out) do Asaas. Você receberá **R$ Y,YY**."
  (taxa lida da API, não hardcoded).
- Histórico de saques.

### Fase 7 — Testes

- Unit: cálculo de saldo (crédito − débito), exclusão de legado, líquido = bruto − taxa,
  validação de mínimo.
- Unit: decisão `withdrawal` do auth webhook (aprova/recusa).
- Int: fluxo de saque end-to-end (saldo → POST withdrawal → transfer mock → débito refletido).
- Int: cron credita em vez de transferir; concorrência de saque (dois requests → um só sai).

---

## ⚠️ Deploy: Fases 2–6 vão juntas

A partir da Fase 2 o cron **para de fazer PIX out** — o dinheiro passa a só acumular em
saldo. Sem a feature de saque (Fases 3–6) no ar, os admins/padrinhos não recebem. Logo,
**não deployar a Fase 2 isolada**: backend (Fases 2–5) e UI (Fase 6) sobem no mesmo
release. Migrations (Fase 1) podem ir antes (colunas nullable, retrocompatíveis).

## Edge cases

- **Saque concorrente:** lock por admin na transação evita double-spend (dois requests
  lendo saldo cheio). O segundo recalcula e vê saldo zerado → `400`.
- **Sem chave PIX:** saque bloqueado com `400`; saldo permanece intacto até cadastrar a chave.
- **Falha no transfer:** `admin_withdrawal` marcado `failed`, não conta como débito; admin
  pode tentar de novo.
- **Order cancelada após settle:** contratualmente não ocorre (estorno só dentro da janela,
  settle só depois). Defensivamente, order `canceled` sai do somatório de crédito.
- **Virada/migração:** orders já transferidas (modelo antigo) ficam fora do saldo novo via
  `*_transferred_at IS NOT NULL`. Orders `captured` ainda não transferidas no momento da
  virada passam a ser creditadas pelo cron — viram saldo sacável (nenhum pagamento duplicado).
- **Asaas serializa `/withdrawals`** (memória do projeto): o saque usa `/transfers` (PIX out),
  que **não** sofre essa serialização — confirmar em homolog antes do prod.

---

## Arquivos-chave

| Arquivo | Mudança |
|---|---|
| `src/shared/database/entities/businessConfig.entity.ts` | + `withdrawal_fee_cents` |
| `src/shared/database/entities/courtAppointmentOrder.entity.ts` | + `*_settled_to_balance_at` |
| `src/shared/database/entities/adminWithdrawal.entity.ts` | **nova** |
| `src/shared/database/migrations/*` | 3 migrations |
| `src/shared/utils/types/businessConfig.ts` | `DEFAULT_BUSINESS_CONFIG` |
| `src/apps/webhook/handlers/internal.ts` | transfer → settlement |
| `src/apps/webhook/handlers/paymentAuth.ts` | + kind `withdrawal` |
| `src/apps/backoffice/services/*` | `WithdrawalService`, ajustes em finance-summary |
| `src/apps/backoffice/routes/private/*` | rotas de saque |
| `ifute-backoffice/*` | UI de saldo/saque + modal de taxa |
</content>
</invoke>

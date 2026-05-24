# Task 11 — Programa de Afiliados (Padrinhos & Indicados)

Planejamento detalhado da feature de afiliação entre administradores do backoffice.
Este documento é a referência única durante a implementação. Quando a feature for entregue,
o resumo das regras fica em [CLAUDE.md](../CLAUDE.md), [README.md](../README.md) e
[ifute-core-simple/CLAUDE.md](../ifute-core-simple/CLAUDE.md) — este arquivo pode ser arquivado.

---

## 1. Visão geral

Permitir que qualquer admin cadastrado no backoffice gere um **link de indicação**.
Quando um terceiro cria conta usando esse link, ele vira **afiliado** do indicador (padrinho).
A partir daí, o padrinho recebe **20% do `tax_value_per_time_block`** de cada bloco
agendado nas quadras do afiliado, durante **3 anos** após o cadastro do afiliado.

Exemplo: `tax_value_per_time_block` = R$ 4,99 (499 centavos)
- Comissão do padrinho por bloco: `floor(20 × 499 / 100)` = **99 centavos** (R$ 0,99)
- Plataforma fica com: 499 − 99 = **400 centavos** (R$ 4,00) por bloco (antes dos custos do Asaas)
- Reserva de 1h30 (3 blocos): padrinho recebe 3 × 99 = R$ 2,97; plataforma fica com 3 × 400 = R$ 12,00

---

## 2. Regras de negócio confirmadas

| # | Regra | Decisão |
|---|---|---|
| 1 | Base de cálculo da comissão | 20% sobre `tax_value_per_time_block` (fixo, R$ 4,99 hoje), arredondado para baixo em centavos |
| 2 | Quem pode ser padrinho | Todo admin cadastrado, automaticamente |
| 3 | Duração do vínculo | 3 anos a partir da data de cadastro do afiliado |
| 4 | Multinível | Não. Apenas indicação direta (1 nível) |
| 5 | Auto-afiliação | Bloqueada (admin não pode usar o próprio link) |
| 6 | Troca de padrinho | Vínculo imutável após criação |
| 7 | Snapshot da % de comissão | Sim — salvar percentual e base por order, para auditoria histórica |
| 8 | Chave PIX para receber comissão | **Separada** da chave PIX usada para receber das quadras. Aba dedicada no backoffice |
| 9 | Quando ocorre o repasse | No mesmo cron `collect_cash` Fase 2, junto do repasse para o admin da quadra. Estado próprio no banco para tracking |
| 10 | Estorno após transfer | Não tratamos. Por contrato com o usuário, estornos só ocorrem enquanto o capital ainda está na master |
| 11 | Mínimo de transferência | Não há problema. 99 centavos por bloco já supera o mínimo do Asaas (1 centavo). Sem batching |
| 12 | Visibilidade no dashboard | V1: lista de afiliados + histórico de comissões recebidas. Evolui depois |

---

## 3. Modelo de dados

### 3.1 `admin_user` — novos campos

| Campo | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `referral_code` | varchar(16) UNIQUE | sim | NULL | Gerado lazy na primeira chamada de "obter meu link". Alfanumérico maiúsculo |
| `referred_by_admin_id` | uuid FK admin_user | sim | NULL | Padrinho. Imutável após set |
| `referred_at` | timestamptz | sim | NULL | Data do vínculo. Usado para calcular expiração dos 3 anos |
| `affiliate_pix_key` | varchar | sim | NULL | Chave PIX dedicada para receber comissões. Distinta de `asaas_pix_key` |
| `affiliate_pix_key_type` | varchar | sim | NULL | `CPF`, `CNPJ`, `EMAIL`, `PHONE` ou `EVP` |

**FK:** `referred_by_admin_id → admin_user(admin_id)` com `ON DELETE SET NULL` (mantém histórico, mas
para o transfer da comissão usaremos o snapshot da order, não esse campo).

**Índices:**
- `idx_admin_user_referred_by` em `referred_by_admin_id` (para listagem de afiliados)
- UNIQUE em `referral_code`

### 3.2 `court_appointment_order` — novos campos

Snapshot na criação + tracking do transfer, espelhando o padrão atual de `admin_pix_key`/`admin_transferred_at`.

| Campo | Tipo | Nullable | Notas |
|---|---|---|---|
| `referrer_admin_id_at_order` | uuid FK admin_user | sim | Snapshot do padrinho do dono do place na hora da order. NULL = sem comissão |
| `affiliate_commission_value_cents` | int | sim | Total de comissão calculado no momento da order, em centavos. NULL se sem padrinho |
| `affiliate_commission_percent_at_order` | smallint | sim | Snapshot do percentual aplicado (20 hoje) |
| `affiliate_pix_key_at_transfer` | varchar | sim | Chave PIX usada no momento do transfer (refetch atual, não snapshot da order) |
| `affiliate_pix_key_type_at_transfer` | varchar | sim | Tipo da chave usada no transfer |
| `affiliate_commission_transferred_at` | timestamptz | sim | Quando o PIX out da comissão foi despachado. NULL = ainda não transferido |
| `affiliate_provider_transfer_id` | varchar | sim | ID do transfer no Asaas. Liga 1:1 com a operação para reconciliação |
| `affiliate_transfer_skipped_reason` | varchar(64) | sim | Motivo do skip mais recente (ex: `"no_pix_key"`, `"referrer_deleted"`) — não bloqueia retry |

**Índice:** `idx_order_affiliate_pending` em `(cash_capture_status, affiliate_commission_transferred_at)`
WHERE `referrer_admin_id_at_order IS NOT NULL AND affiliate_commission_value_cents > 0` —
cron Fase 2 lookup.

### 3.3 `business_config` — novo campo

| Campo | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `affiliate_commission_percent` | smallint | não | 20 | Percentual aplicado sobre `tax_value_per_time_block` para a comissão do padrinho |

> Não criamos `affiliate_link_validity_years` por enquanto — fica hardcoded como `3` no service.
> Se virar negociável no futuro, vira config.

### 3.4 Snapshot já existente que aproveitamos

`court_appointment_order.business_config_at_order_time` (JSON) já contém o snapshot de `BusinessConfig`.
Adicionamos `affiliate_commission_percent` ao schema do JSON mas **também salvamos
`affiliate_commission_percent_at_order` flat** porque consultas por essa coluna são frequentes
(dashboard de comissões). Trade-off aceito: redundância controlada para evitar queries em JSON.

### 3.5 Migration plan (TypeORM)

Seguir o padrão das últimas migrations (`1777xxxxxxxxxx-Nome.ts`):

1. `1779000000000-AdminUserAffiliateFields.ts` — adiciona os 5 campos em `admin_user` + FK + índices.
2. `1779000000001-CourtAppointmentOrderAffiliateFields.ts` — adiciona os 8 campos em `court_appointment_order` + índice.
3. `1779000000002-BusinessConfigAffiliatePercent.ts` — adiciona `affiliate_commission_percent` com default `20`.

Cada migration é reversível (`down()` dropa o que `up()` criou).

---

## 4. Backend (`ifute-core-simple/`)

### 4.1 Service novo: `AffiliateService`

Arquivo: `src/apps/backoffice/services/affiliate.service.ts`

Métodos públicos:

```ts
// Geração e leitura do código próprio
getOrCreateReferralCode(adminId): Promise<string>
getMyAffiliateLink(adminId): Promise<{ code: string; url: string }>

// Setup do PIX dedicado
updateAffiliatePixKey(adminId, key, type): Promise<void>
getAffiliatePixKey(adminId): Promise<{ key: string | null; type: string | null }>

// Vínculo no signup (chamado pelo handler de auth quando user é novo)
attachReferrerOnSignup(newAdminId, referrerCode): Promise<void>
  // - Resolve code → admin
  // - Bloqueia self-referral
  // - Bloqueia se newAdmin já tem referred_by (idempotência defensiva)
  // - Set referred_by_admin_id + referred_at no newAdmin

// Cálculo (chamado pelo OrderService.createOrder)
computeCommissionForOrder(input: {
  placeOwnerAdminId: string;
  taxValuePerTimeBlockCents: number;
  blocksCount: number;
}): Promise<{
  referrerAdminId: string;     // ou null se sem comissão
  commissionValueCents: number; // ou 0
  commissionPercent: number;    // ou 0
}>
  // - Lookup placeOwner.referred_by_admin_id e referred_at
  // - Verifica se referred_at + 3 anos > agora (vínculo válido)
  // - Aplica BusinessConfig.affiliate_commission_percent
  // - Retorna { null, 0, 0 } se sem padrinho ou expirado

// Listagens (backoffice dashboard)
listAffiliates(adminId, cursor?): Promise<PaginatedAffiliates>
  // Itens: { admin_id, name, email, referred_at, expires_at, total_commission_paid_cents }

listCommissions(adminId, cursor?): Promise<PaginatedCommissions>
  // Itens: { order_id, value_cents, transferred_at, status, place_name }
  // status: "pending" | "transferred" | "skipped"
```

Helpers internos:
- `generateUniqueReferralCode()` — 8 chars, retry em colisão (rara)
- `isReferralLinkValid(referredAt: Date)` — `Date.now() < referredAt + 3 anos`
- `floorCommissionCents(taxCents, percent)` — `Math.floor((taxCents * percent) / 100)`

### 4.2 Routes novas

Arquivo: `src/apps/backoffice/routes/private/affiliate.ts`

```
GET    /backoffice/private/affiliate/code           — getOrCreateReferralCode
GET    /backoffice/private/affiliate/link           — getMyAffiliateLink
GET    /backoffice/private/affiliate/pix-key        — getAffiliatePixKey
PATCH  /backoffice/private/affiliate/pix-key        — updateAffiliatePixKey
GET    /backoffice/private/affiliate/affiliates     — listAffiliates (paginado, cursor)
GET    /backoffice/private/affiliate/commissions    — listCommissions (paginado, cursor)
```

Registrar no `src/apps/backoffice/index.ts` (ou onde os router files são montados).

### 4.3 Validators (Joi)

Adicionar em `src/apps/backoffice/validators/`:
- `updateAffiliatePixKey`: `{ key: string, type: enum }`
- Pagination cursor (reaproveitar shape se já existir)

### 4.4 Modificação no fluxo de signup (login Google)

O backoffice usa Google login. Quando o backend cria o `AdminUser` pela primeira vez,
chamamos `attachReferrerOnSignup` se o payload trouxe `referrer_code`.

**Pontos a investigar/alterar:**
- Endpoint de login (provavelmente em `src/apps/backoffice/routes/public/auth.ts` ou similar)
- Aceitar campo opcional `referrer_code` no body
- No `AuthService.handleGoogleLogin`: detectar se é criação (admin novo) ou login (existente).
  Só chama `attachReferrerOnSignup` se for criação.

### 4.5 Modificação em `createCourtAppointmentOrder`

Local atual: provavelmente em `src/shared/services/...` ou `src/apps/mobile/services/payment.service.ts`.
A confirmar durante implementação.

Antes de persistir a order:

```ts
const ownerAdminId = await getPlaceOwnerAdminId(placeId);
const commission = await affiliateService.computeCommissionForOrder({
  placeOwnerAdminId: ownerAdminId,
  taxValuePerTimeBlockCents: businessConfig.tax_value_per_time_block,
  blocksCount: blocks.length,
});

order.referrer_admin_id_at_order = commission.referrerAdminId;
order.affiliate_commission_value_cents = commission.commissionValueCents;
order.affiliate_commission_percent_at_order = commission.commissionPercent;
```

### 4.6 Modificação em `collect_cash` Fase 2

Local: `src/apps/webhook/handlers/internal.ts` (linhas 144-264).

**Atual:** itera ordens em `captured` com `admin_transferred_at IS NULL`, dispara PIX out para o admin.

**Novo (após o transfer do admin OU em iteração separada):**

```ts
// Critério de elegibilidade: order.cash_capture_status = 'captured'
//   AND order.referrer_admin_id_at_order IS NOT NULL
//   AND order.affiliate_commission_value_cents > 0
//   AND order.affiliate_commission_transferred_at IS NULL
//   AND elegível pela mesma janela de cancelamento já usada hoje

const referrer = await loadAdmin(order.referrer_admin_id_at_order);

if (!referrer || referrer.deleted_at) {
  await markSkipped(order.id, 'referrer_deleted');
  continue;
}

if (!referrer.affiliate_pix_key) {
  await markSkipped(order.id, 'no_pix_key');
  continue;
}

const transfer = await provider.transferToWallet({
  pixAddressKey: referrer.affiliate_pix_key,
  pixAddressKeyType: referrer.affiliate_pix_key_type,
  value: order.affiliate_commission_value_cents / 100,
  externalReference: `${order.id}-affiliate`, // distingue do transfer do admin
});

await orderRepo.update(order.id, {
  affiliate_commission_transferred_at: new Date(),
  affiliate_pix_key_at_transfer: referrer.affiliate_pix_key,
  affiliate_pix_key_type_at_transfer: referrer.affiliate_pix_key_type,
  affiliate_provider_transfer_id: transfer.id,
  affiliate_transfer_skipped_reason: null,
});
```

**Independência:** o transfer da comissão **não bloqueia** nem **depende de** o transfer
do admin estar concluído. São idempotentes e independentes — uma falha em um não impede o outro.

**Custo operacional:** cada order com comissão dispara 2 PIX out (admin + padrinho), cada um a
~R$ 1,99. Esse custo do segundo PIX é absorvido pela plataforma (sai dos R$ 4,00 que sobram após
a comissão de 99 centavos). Documentar isso no CLAUDE.md.

### 4.7 Modificação no webhook de autorização (`paymentAuth.ts`)

Atual `decideTransfer` reconhece `externalReference = order_id`. Estender para reconhecer
`{order_id}-affiliate` como **kind interno `affiliate_transfer`**:

```ts
// Pseudocódigo
if (externalReference.endsWith('-affiliate')) {
  const orderId = externalReference.replace(/-affiliate$/, '');
  const order = await loadOrder(orderId);
  if (!order) return refuse('order_not_found');
  if (order.cash_capture_status !== 'captured') return refuse('wrong_state');
  if (!order.referrer_admin_id_at_order) return refuse('no_referrer');
  if (order.affiliate_commission_value_cents <= 0) return refuse('zero_commission');
  if (value > order.affiliate_commission_value_cents / 100) return refuse('value_too_high');

  const referrer = await loadAdmin(order.referrer_admin_id_at_order);
  if (!referrer?.affiliate_pix_key) return refuse('no_pix_key');

  return approve();
}
```

`provider_auth_decision_log` já garante idempotência por `(provider, provider_operation_id)` —
sem mudança de schema.

### 4.8 Bloqueios a aplicar

- **Auto-afiliação:** `attachReferrerOnSignup` rejeita silenciosamente se `referrerCode` resolve para o próprio admin
- **Código inválido:** rejeita silenciosamente (não falha o signup)
- **Vinculação tardia:** sem endpoint para vincular após signup. Vínculo só na criação.

### 4.9 Testes

- **Unit:**
  - `floorCommissionCents` — bordas (0, 1, 100, máximo)
  - `isReferralLinkValid` — exatamente 3 anos, fronteira
  - `computeCommissionForOrder` — sem padrinho, padrinho expirado, padrinho válido
  - `generateUniqueReferralCode` — colisão simulada

- **Integration:**
  - Signup com `referrer_code` válido → vínculo criado
  - Signup com próprio código → vínculo NÃO criado (silencioso)
  - Signup com código inexistente → vínculo NÃO criado (silencioso)
  - Order criada com referrer válido → snapshot correto
  - Order criada com referrer expirado (>3 anos) → sem snapshot
  - Cron Fase 2 dispara 2 transfers (admin + afiliado)
  - Cron Fase 2 com `affiliate_pix_key=null` → admin transferido, afiliado pulado com `no_pix_key`
  - Webhook auth `{order_id}-affiliate` aprovado quando válido

---

## 5. Backoffice (`ifute-backoffice/`)

### 5.1 Captura do `?ref=` no login

Arquivo: `src/pages/public/Login/index.tsx`

Ler `useSearchParams().get('ref')` e passar como argumento para `googleLogin`. O AuthContext
passa pro backend no payload. Se o usuário já existe (login normal), o backend ignora o code.

### 5.2 Nova rota e menu

- `src/routes/routes.tsx`: adicionar `/dashboard/affiliates` apontando para `<Affiliates />`
- `src/components/Organisms/Drawable/index.tsx`: adicionar item "Parceiros" (ícone `people` ou similar)
- `src/utils/consts/routes.ts`: adicionar `'/dashboard/affiliates': 'Parceiros'`

### 5.3 Página `Affiliates`

Estrutura: `src/pages/private/Affiliates/{index.tsx, Affiliates.tsx, styles.ts}`

Seções (V1):

1. **Card "Meu link de parceiro"**
   - Mostra a URL completa (`https://backoffice.ifute.com.br/login?ref=XXXX`)
   - Botão "Copiar link"
   - Texto explicativo curto: "Compartilhe este link. Quem criar conta por ele vira seu afiliado por 3 anos. Você recebe 20% da taxa da iFute em cada agendamento das quadras dele."

2. **Card "Chave PIX para receber comissões"**
   - Form com seletor de tipo (CPF/CNPJ/EMAIL/PHONE/EVP) e input de chave
   - Botão "Salvar"
   - Aviso: "Esta chave é separada da chave que você usa para receber pelos seus locais"

3. **Lista "Meus afiliados"**
   - Colunas: Nome, Email, Desde, Vínculo expira em
   - Paginação por cursor (padrão de Finances)
   - Estado vazio: "Você ainda não tem afiliados. Compartilhe seu link!"

4. **Lista "Comissões recebidas"**
   - Colunas: Data, Local/Quadra, Valor, Status (Pago / Pendente)
   - Paginação por cursor
   - Estado vazio: "Nenhuma comissão registrada ainda"

### 5.4 Store + API

- `src/stores/affiliates.store.ts` — MobX, segue padrão de `adminPlaces.store.ts`
- `src/api/axios/Affiliate.axios.ts` — segue padrão de `AdminUser.axios.ts`

### 5.5 Componentes

- `src/components/Organisms/AffiliatesList/` (lista de afiliados)
- `src/components/Organisms/CommissionsList/` (lista de comissões)
- Reaproveitar `Button`, `Input`, `SectionTitleWrapper`, `MessageIcon`

---

## 6. Mobile (`ifute/`)

**Sem mudanças.** O programa de afiliados é entre admins do backoffice. Usuários finais
do app não têm vínculo de indicação. Confirmado com o usuário.

---

## 7. Edge cases

| Caso | Tratamento |
|---|---|
| Padrinho deletado entre order e transfer | `affiliate_transfer_skipped_reason = 'referrer_deleted'`. Log. Sem retry automático bem-sucedido (até admin ser restaurado, o que hoje não acontece) |
| Padrinho sem chave PIX cadastrada | Skip com `'no_pix_key'`. Retry no próximo tick. Quando admin cadastrar a chave, próximo tick paga |
| Order cancelada antes de captured | Comissão nunca disparada (Fase 2 só roda em `captured`). OK |
| Vínculo expirou entre order e transfer | Não importa. Snapshot foi feito na criação da order. Se foi calculado, vai ser pago |
| Admin gera link mas nunca cadastra PIX | Pode gerar link e ter afiliados normalmente. Comissões ficam pendentes até cadastrar |
| Comissão = 0 (config futura colocou em 0%) | `referrer_admin_id_at_order` setado, valor 0. Cron pula (filtro `> 0`). OK |
| Chargeback após transfer | Não tratamos (acordo contratual com o usuário) |
| Múltiplas orders do mesmo afiliado no mesmo tick | Cada uma gera seu próprio transfer. Asaas dedup via `externalReference` único |

---

## 8. Plano de execução em fases

| Fase | Escopo | Dependências |
|---|---|---|
| 0 | **Documentação (esta task)** — CLAUDE.md raiz, README, ifute-core-simple/CLAUDE.md, este planning | — |
| 1 | Migrations (3 arquivos) | Fase 0 |
| 2 | `AffiliateService` (sem cron ainda) + endpoints de código/PIX/listagens | Fase 1 |
| 3 | Hook no fluxo de login Google para `attachReferrerOnSignup` | Fase 2 |
| 4 | Hook em `createCourtAppointmentOrder` para snapshot da comissão | Fase 1 |
| 5 | Cron `collect_cash` Fase 2: transfer da comissão | Fase 4 |
| 6 | Webhook auth: extender `decideTransfer` para `affiliate_transfer` | Fase 5 |
| 7 | Backoffice: rota, menu, página Affiliates, store, axios | Fases 2 + 3 |
| 8 | Testes (unit + integration) | Cada fase tem seus testes; consolidação aqui |
| 9 | Deploy + smoke test em prod | Tudo acima |

Cada fase é um PR separado quando possível.

---

## 9. Pontos abertos / decisões adiadas

- **Notificação ao padrinho** quando ganha um novo afiliado ou recebe comissão (push? email?). V2.
- **Dashboard analítico** (gráficos de comissão por mês, top afiliados). V2.
- **Programa configurável** (% diferente por padrinho, duração diferente, tier por volume). Fora do escopo.
- **Link customizado / vanity codes** (ex: `?ref=joao` em vez de `?ref=A7B2X9KL`). Fora do escopo.
- **Convite por email direto** dentro do backoffice. V2.
- **Métrica de conversão do link** (visitas vs cadastros). V2.

---

## 10. Glossário (novos termos)

| Termo (EN) | Termo (PT) | Definição |
|---|---|---|
| Referrer / Partner | Padrinho / Parceiro | Admin que indicou outro admin via seu link |
| Affiliate / Referee | Afiliado / Indicado | Admin que se cadastrou usando link de outro admin |
| Referral Code | Código de indicação | String única associada a cada admin, usada em `?ref=CÓDIGO` |
| Affiliate Commission | Comissão de afiliação | 20% do `tax_value_per_time_block` repassado ao padrinho a cada bloco agendado nas quadras do afiliado |
| Affiliate PIX Key | Chave PIX de afiliação | Chave PIX dedicada a receber comissões. Separada da chave usada para receber pelos locais |
| Referral Link Validity | Validade do vínculo | 3 anos a partir do cadastro do afiliado |

Foi criado recentemente um novo backoffice master.

Precisamos adicionar uma nova funcionalidade de saque neste backoffice.

Possívelmente seja necessário também criar um controle de saldo do que é de fato da plataforma, assim como já existe por exemplo saldo do dono da quadra e também saldo de comissões de algum parceiro específico.

Este saldo ajudaria a não retirarmos dinheiro que de fato não é da plataforma, tirando liquidez indevidamente e afetando os demais participantes.

Qualquer dúvida, ou alinhamento que seja necessário, só comentar!

---

## Plano de Ação (2026-07-17)

### Entendimento do problema

Todo dinheiro cai integralmente na conta master da iFute no Asaas. Depois da janela de
cancelamento, o cron `collect_cash` (Fase 2) credita:

- o **net** da ordem no saldo do dono da quadra (`admin_settled_to_balance_at`);
- a **comissão** no saldo do padrinho (`affiliate_settled_to_balance_at`).

O que **de fato é da plataforma** por ordem já é calculado (`computeOrderFinancials` +
`director.service`): `net_margin = platformTax − comissão de afiliado`. O provider fee
(PIX in) o Asaas desconta no recebimento, e o `net` do admin já o embute — então
`net_margin` é exatamente o que sobra da plataforma na master depois de quitar admin e
padrinho.

Hoje **não há** nenhuma chave PIX / saldo "da plataforma", e o master-backoffice é
read-only (só relatórios GET). Este é o primeiro fluxo que move dinheiro real da master.

**Definição do saldo sacável da plataforma:**

```
platform_available_cents
  = Σ net_margin(ordens capturadas FORA da janela de cancelamento)
  − Σ saques da plataforma ativos (processing/dispatched)
```

"Fora da janela" = `admin_settled_to_balance_at IS NOT NULL OR admin_transferred_at IS NOT NULL`
(inclui ordens legado — decisão confirmada). Só contar ordens fora da janela garante que
estornos (que devolvem o `gross` inteiro) nunca tocam esse dinheiro, e como só somamos
`net_margin`, os passivos de admin/padrinho continuam cobertos na master por construção.

### Decisões confirmadas
- **Destino do saque:** chave PIX da plataforma em `BusinessConfig` (`platform_pix_key` +
  `platform_pix_key_type`), editável por uma tela do master-backoffice.
- **Valor:** saca sempre o **saldo total** (espelha o fluxo do admin/afiliado).
- **Escopo:** inclui a margem das ordens **legado**.

### Backend — `ifute-core-simple`

1. **Entidade + migration**
   - Nova entidade `PlatformWithdrawal` (`platform_withdrawal`): `id`, `gross_cents`,
     `fee_cents`, `net_cents`, `payment_provider`, `pix_key_at_withdrawal`,
     `pix_key_type_at_withdrawal`, `provider_transfer_id?`, `status`
     (`processing`/`dispatched`/`failed`), `requested_by_admin_id` (auditoria: qual diretor
     sacou), `created_at`, `dispatched_at?`. Espelha `AdminWithdrawal` sem `admin_id`/`balance_type`.
   - Adicionar `platform_pix_key` + `platform_pix_key_type` (nullable) em `BusinessConfig`.
   - Migration cria a tabela + as 2 colunas. Registrar entidade no datasource e em `Repositories`.
   - Rodar em prod via `migrate-prd.sh` após o release do core (`ASSUME_YES=1` em background).

2. **Promover helpers de saque para `shared/`**
   - `resolveWithdrawal` e `sumActiveWithdrawalGrossCents` (hoje em
     `backoffice/services/withdrawal.service.ts`) sobem para `shared/utils/helpers` — passam a
     ser usados por dois apps. `AdminWithdrawalStatus` já é compartilhável.

3. **`PlatformWithdrawalService`** (`backoffice-director/services/platformWithdrawal.service.ts`)
   - `computePlatformAvailableCents(manager)`: carrega ordens `captured` fora da janela, soma
     `platformTaxCents − affiliateCommissionCents` (via `computeOrderFinancials`), subtrai
     saques ativos.
   - `getBalance` → `{ available_cents, fee_cents, withdrawn_cents }`.
   - `requestWithdrawal`: TX com `SELECT ... FOR UPDATE` na linha de `business_config`
     (serializa saques da plataforma) → recalcula saldo → valida `saldo > taxa` → resolve a
     chave PIX da plataforma (rejeita se não cadastrada) → insere `platform_withdrawal`
     (`processing`) e commita → fora da TX chama `provider.transferToWallet(net,
     externalReference="platform-withdrawal-{id}")` → sucesso `dispatched`, falha `failed`.
     Mesma mecânica do `WithdrawalService`.
   - `listWithdrawals`.

4. **Rotas** (`backoffice-director/routes/private/`)
   - `withdrawal.ts`: `GET /balance`, `POST /`, `GET /` → montar em `/director/private/withdrawal`.
   - `config.ts`: `GET /platform-pix-key`, `PATCH /platform-pix-key` (ler/gravar a chave em
     `BusinessConfig`) → montar em `/director/private/config`.

5. **Auth webhook** (`webhook/handlers/paymentAuth.ts`)
   - Adicionar `PLATFORM_WITHDRAWAL_PREFIX = "platform-withdrawal-"` e rotear em `decideTransfer`
     para `decidePlatformWithdrawalTransfer`: valida contra a linha `platform_withdrawal`
     (existe, não `failed`, `value ≤ net_cents/100 + tol`) → aprova. Não colide com
     `withdrawal-` nem `-affiliate`.
   - Atualizar a tabela de `kind`/`externalReference` no `ifute-core-simple/CLAUDE.md`.

6. **Testes** — `*.unit.spec.ts` puros (sem DB, conforme o harness atual): agregação de
   `net_margin` e reuso de `resolveWithdrawal`.

### Frontend — `ifute-master-backoffice`

7. **API** — `src/api/platform-withdrawal.ts` (`getBalance`, `requestWithdrawal`,
   `listWithdrawals`) + `src/api/config.ts` (chave PIX) + query keys.
8. **Página** — `src/pages/withdrawals.tsx` ("Saque da plataforma"): saldo disponível, taxa,
   "você receberá R$ X", botão de saque com diálogo de confirmação, histórico de saques com
   status, e seção para cadastrar/editar a chave PIX da plataforma.
9. **Rota + navegação** — adicionar `withdrawals: '/dashboard/withdrawals'` em `ROUTES`, rota
   lazy filha do `DashboardLayout`, e link no header/layout.

### Fora de escopo / observações
- Só o **core-simple** precisa de release + migration em prod; o master-backoffice roda local
  (só puxar o código e buildar).
- Sem `platform_settled_to_balance_at` nem nova fase de cron: o saldo é derivado on-the-fly dos
  marcadores existentes — mais simples e sem migration de dados.
- Estornos pós-settlement não são tratados (contrato já garante estorno só dentro da janela).

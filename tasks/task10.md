Possívelmente o Identificador de Carteira Asaas não esteja mais sendo utilizado, já que os repasses ocorrem somente por PIX OUT para chave pix declarada pelo administrador do local.

Avaliar se não é possível remover este campo da configuração.

=================

## RESOLVIDO

Confirmado: o `asaas_wallet_id` virou letra morta para a função original (split do Asaas) depois que migramos para o modelo de **deferred-split via PIX out**. `transferToWallet` usa `pixAddressKey`, e nenhum caller passa `split` em `createAuthorizedPayment`. A coluna sobrou só como sentinela de "admin configurou Asaas" em dois gates desalinhados.

### Mudanças

**`ifute-core-simple/`** (branch `refactor/remove-asaas-wallet-id`):
- Migration `1777600000000-DropAsaasWalletId.ts` dropa a coluna
- `AdminUser` entity: campo removido
- `place.service.ts`: gate de visibilidade de places trocado para `asaas_pix_key IS NOT NULL` (que é o que de fato é necessário pra repasse)
- `adminUser.service.ts`: removido do create/update; gate de finanças agora exige só `asaas_account_api_key_enc`
- `adminUser` validator: campo removido
- `query.ts`: `GetRelationPlaceOwnerAccountsIDsType` e SQL não trazem mais o campo
- `dataset.ts`: seed sem o campo
- `internal.unit.spec.ts`: ~30 mocks limpos
- `CLAUDE.md`: descrição de AdminUser atualizada (PIX key + API key, sem split)
- 304/304 testes passando

**`ifute-backoffice/`** (branch `refactor/remove-asaas-wallet-id`):
- `AdminUser` type + `GetAdminUserResponse` + `UpdateAsaasCredentialsRequestProps`: campo removido
- `AsaasConfig` (page + Template + form): input "Identificador de Carteira Asaas" removido; descrição atualizada
- `AddPlace`: `isActivated` agora checa `asaas_pix_key`
- `Finances`: `isActivated` simplificado para apenas `has_asaas_api_key` (que é o que realmente importa pra ler saldo)

### Risco / migração

Sem produção rodando — banco será remontado pelas seeds. Sem backfill ou compat shim.

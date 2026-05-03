Acho que encontrei um bug, especificamente na coluna tax_value_per_hour do business_config, o nome está errado, e provável que também a lógica de cálculo para este campo esteja incorreto.

O nome deveria ser algo como tax_value_per_time_block o que significa que para cada bloco de horário (30 min) selecioando é acrescido N vezes o valor de tax_value_per_time_block.

Exemplo de bug: ao selecionar apenas um bloco (30 min) a taxa do ifute está sendo de R$1,00 onde deveria ser de 1,99 de acordo com o valor do banco de dados, se fossem 2 blocos selecionados (1h) deveria ser R$3,98 de taxa para o ifute

Revise esta parte e confirme se está correto ou precisará correção ou até mesmo docoumentação em regra de negócio.

Qualquer questão a mais, só perguntar

=================

## RESOLVIDO

Bug confirmado em duas dimensões: nome enganoso da coluna E lógica inconsistente entre fluxos diferentes (mobile cobrava metade do esperado; recorrência cobrava certo, mas o repasse ao admin descontava só metade da comissão).

### Mudanças

**`ifute-core-simple/`** (branch `fix/tax-value-per-time-block`):
- Migration `1777500000000-RenameTaxValueColumn.ts` renomeia `business_config.tax_value_per_hour` → `tax_value_per_time_block`
- `BusinessConfig` entity, `DEFAULT_BUSINESS_CONFIG`, `FeeInput` (`platformFeePerHour` → `platformFeePerTimeBlock`, `hoursAppointed` → `blocksAppointed`)
- `fees.ts` (Asaas), `pricing.ts`, `place.ts` helpers — todos passam a falar em blocos
- `mobile/payment.service.ts` — passa `blocks` direto (eliminado `BLOCKS_TO_HOURS_FACTOR`)
- `backoffice/payment.service.ts` — query param renomeado para `blocksAppointed`
- `webhook/handlers/internal.ts` — `computeAdminTransferValue` e `generatePaymentIntentDataBulk` recalculam por bloco (sem o `× 0.5` que estava incorreto)
- 2 testes de regressão novos em `fees.unit.spec.ts` travando exatamente o cenário do bug report (1 bloco → 1.99; 2 blocos → 3.98)
- Suíte completa: 284 testes passando

**`ifute-backoffice/`** (branch `fix/tax-value-per-time-block`):
- `useFinalCostPreview` hook + `GetCostBreakdownParams` type — renomeado `hoursAppointed` → `blocksAppointed`
- Default do hook mudou de `1` para `2` (preserva semântica de preview "para 1 hora", agora calculada corretamente)

**`ifute-ecossystem/CLAUDE.md`** + `ifute-core-simple/CLAUDE.md`:
- Removida referência a valor fixo (R$ 4,99) — DB é a única fonte de verdade
- Glossário adiciona `tax_value_per_time_block`

### Configuração necessária pós-deploy

Como combinado, sem migração de dados — banco será remontado pela seed. Apenas garantir que o seed atualize o nome da coluna na criação do registro de `business_config`.

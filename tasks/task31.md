# Task 31 — Adequar o ecossistema ao PIX-only e à posição comercial honesta

## Contexto

Duas conclusões do plano de vendas ([`reports/2026-08-12-plano-vendas-donos-quadra.md`](../reports/2026-08-12-plano-vendas-donos-quadra.md)) exigem mudança em código e conteúdo:

1. **Pagamento é 100% PIX.** Cartão de crédito está desligado em produção (flag `useCreditCardPayment = false` no Remote Config), mas a landing, a metadata de SEO, as FAQs, os termos de uso e alguns defaults de código ainda anunciam ou assumem cartão. Quem chega pela landing lê uma promessa que o app não cumpre.
2. **A landing promete demanda que ainda não existe.** A `/business` diz "coloque seu centro esportivo na frente de milhares de atletas". Produção não tem quadra real cadastrada e o `discover` devolve lista vazia ([`reports/2026-08-08-rastreio-usuario-prod.md`](../reports/2026-08-08-rastreio-usuario-prod.md)). Prometer audiência que não existe queima a credibilidade no primeiro follow-up de venda.

Há também uma **correção de entendimento** que precisa ficar registrada porque afeta o que se comunica: o PIX IN (R$ 1,99) é **repassado ao cliente final**, não descontado da taxa da plataforma (`calculateAsaasPixCostBreakdown`: `finalValue = netValue + taxa × blocos + 1,99`). Logo:

- a margem da plataforma é **constante** em `tax_value_per_time_block` por bloco, independente da duração da reserva;
- quem se beneficia de reserva longa é o **jogador**, que dilui o R$ 1,99 fixo em mais blocos;
- o total de taxas de 1h é R$ 11,97 (R$ 9,98 + R$ 1,99), o que dá **~R$ 1,00 por jogador** num rachão de 12 — esse é o número a usar em material comercial, não R$ 9,98.

## Objetivo

Deixar todo o ecossistema coerente com o PIX-only e com uma proposta de valor que o produto entrega hoje, sem prometer rede que ainda não existe.

## Princípio de conteúdo

PIX-only **não é limitação a esconder, é vantagem a vender**:

- **dinheiro à vista** — sem esperar liquidação de cartão;
- **sem chargeback** — PIX não tem contestação;
- **sem mudança de comportamento** — o jogador já paga quadra por PIX;
- **sem pedir dados de cartão** — menos atrito e menos desconfiança no checkout.

E dois fraseados que **não** podem aparecer em lugar nenhum:

- ❌ "cobrança automática do mensalista" — sem cartão tokenizado não há débito automático. A recorrência gera **uma nova cobrança PIX por ciclo, com lembrete**. O correto é "fatura gerada automaticamente" / "o app cobra por você".
- ❌ "milhares de atletas" / qualquer número de audiência.

## Escopo

### 1. `ifute-landing-page`

| Arquivo | Mudança |
|---|---|
| `src/lib/site.ts` | `playerFaq`: tirar "PIX ou cartão" da resposta de abertura; reescrever "Quais meios de pagamento estão disponíveis?" para PIX-only vendendo o motivo. `businessFaq`: incluir pergunta sobre meio de pagamento (dinheiro à vista, sem chargeback) e uma sobre como funciona o mensalista, com o fraseado correto |
| `src/app/layout.tsx` | Metadata raiz (3 ocorrências: `description`, OpenGraph, Twitter) — "pague com PIX ou cartão" → PIX |
| `src/app/page.tsx` | Hero, passo "Agende", seção de pagamento (título, parágrafo) e o bullet "Cartão de crédito com opção de parcelamento" |
| `src/app/business/page.tsx` | Hero: trocar "milhares de atletas" por prova de operação. Benefício de recebimento: enfatizar à vista. Benefício de recorrência: fraseado correto. Seção financeira: explicitar PIX-only |
| `src/app/partners/page.tsx` | Nenhuma mudança necessária — já é PIX-native e não cita cartão |

### 2. `ifute-docs`

| Arquivo | Mudança |
|---|---|
| `src/public/docs/pt-br/terms-of-use.md` | Linha "Os pagamentos são processados através do **Asaas** (PIX e cartão)" → só PIX |

### 3. `ifute` (app mobile)

| Arquivo | Mudança |
|---|---|
| `src/contexts/RemoteConfigContext.tsx` | `DEFAULT_FLAGS.useCreditCardPayment` de `true` → `false`. Hoje há uma janela entre o boot e o `fetchAndActivate` em que a tela de pagamento pode oferecer cartão |
| `src/services/remoteConfig.ts` | Comentário do `REMOTE_CONFIG_DEFAULTS` diz "Both payment methods stay enabled" — está defasado (o valor já é `false`) |

> A tela `Payment` já monta as opções a partir das flags, e a `PaymentCardForm` só é alcançada quando cartão está ligado. Nenhuma mudança de UI é necessária além dos defaults.

### 4. `ifute-core-simple`

| Arquivo | Mudança |
|---|---|
| `src/shared/services/payment/providers/asaas/AsaasProvider.ts` | `createAuthorizedPayment`: default de `paymentMethod` de `"credit-card"` → `"pix"`. Hoje nenhum caller depende do default (todos os 4 passam explicitamente), então é mudança segura — o valor está em evitar que um caller **futuro** que omita o campo caia num `PaymentProviderError("invalid_input")` cuja mensagem aponta para o lugar errado |
| `CLAUDE.md` | Marcar o fluxo de cartão como legado inativo e o PIX como único ativo |

**Não remover** o caminho de cartão: a recorrência legada (`internal.ts:813`) usa `creditCardToken` de orders antigas. Manter adormecido e reversível.

### 5. `ifute-backoffice`

| Arquivo | Mudança |
|---|---|
| `src/config/domain.ts` | `PAYMENT_TYPE_LABELS['credit-card'] = 'Cartão'` — **manter**, é label de exibição de orders históricas. Só documentar que cartão não é mais ofertado |

### 6. Raiz do meta-repo

`CLAUDE.md` e `README.md` — **já atualizados** em 12/08/2026: taxas de cartão removidas do modelo de custo, PIX declarado único meio, e a fórmula do gross-up registrada para não se repetir o erro de achar que o PIX IN sai da margem.

## Fora de escopo (itens do plano de vendas que viram tasks próprias)

- Captura de lead na landing (formulário + CRM) — hoje todo CTA joga direto no backoffice e o lead que não converte é perdido sem rastro
- Simulador de receita para o **dono** (hoje só existe para o padrinho)
- Geração de QR code / material impresso por local no backoffice
- Funil de onboarding e taxa de conversão do PIX no master-backoffice
- Reserva mínima de 1 hora configurável por local
- Isenção temporária de taxa para local novo
- Definir quem paga o PIX OUT do estorno

## Verificação

Executada em 12/08/2026:

- [x] Nenhuma promessa de cartão na landing e nos docs (as menções restantes contrastam *contra* cartão, não o ofertam)
- [x] `grep -ri "milhares" ifute-landing-page/src` vazio
- [x] Nenhum texto promete débito automático de mensalista
- [x] Build da landing passa (`npm run build`)
- [x] Typecheck passa: `ifute-core-simple`, `ifute` (app), `ifute-backoffice`
- [x] Testes unitários do core: **396 passando**. Os `.int.spec.ts` falham por exigirem Postgres — condição pré-existente, não relacionada
- [x] `AsaasProvider.unit.spec.ts`: os três testes que dependiam do default `credit-card` passaram a declarar `paymentMethod` explicitamente (a intenção era testar o caminho de cartão, não o default), e foi somado um teste novo cobrindo o default PIX

## Pendências que não são de código

- [ ] **Confirmar no console do Firebase** que `useCreditCardPayment` é `false`. Os defaults locais só valem se o `fetchAndActivate` falhar — o valor remoto é a fonte de verdade e não é verificável a partir do repositório
- [ ] Deploy: `release.sh ifute-landing-page ifute-docs` (conteúdo) e `ifute-core-simple` (default do provider). Bumpar `version` do `package.json` de cada um **antes** do release
- [ ] O app mobile precisa de build/publicação nas lojas para o novo default do `RemoteConfigContext` chegar aos usuários — até lá, quem já tem o app instalado depende do valor remoto do Firebase (mais um motivo para o primeiro item)

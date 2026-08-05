We have a problem... when trying to check how much it will cost to make appointment, the value appear as 0 reais in the screen where says "Confira abaixo se os horários e os campos ou quadras estão corretos".

Also noted that, while i'm logged in, the final cost actually appears calculated.

We need to check what is going on and why is not allowing unlogged users to check final cost prices...

If you need any more information from me, please let me know.

---

## Diagnóstico

O total exibido na tela de resumo (`PreScheduleResume`) **não é calculado no app** — a fórmula de
taxa vive só no backend. A tela busca o preview em `GET /mobile/private/payment/cost-breakdown` e
renderiza o `finalValue`.

O problema é o prefixo `/private`: esse router monta `authenticateToken`
([`routes/private/index.ts`](../ifute-core-simple/src/apps/mobile/routes/private/index.ts)), então
sem token a request morre em **401** antes de chegar no handler. No app, o `costBreakdown` nunca
chega ao store e o fallback `?? 0` renderizava **R$ 0,00**. Logado, o token vai no header e o valor
aparece correto — exatamente o comportamento relatado.

Agravante: o interceptor de resposta do axios chama `UnauthorizedObservable.notify()` em qualquer
401, e o `AuthContext` assina isso com `signOut` — ou seja, a tela disparava um sign-out a cada
montagem para usuário anônimo.

Vale notar que o handler `PaymentService.getCostBreakdown` é **leitura pura** (lê `BusinessConfig` e
chama `provider.calculateCostBreakdown`); não usa `req.user` para nada. Não havia motivo para exigir
autenticação — foi só a rota ter nascido dentro do router privado.

## Correção

Seguindo a convenção que já existia para as outras telas pré-login (`place` e
`preRecurrentAppointmentNextDayAvailable` têm cópia pública), o preview passou a ter espelho público
e o app escolhe a rota conforme o estado de login.

**Backend (`ifute-core-simple`)**

- Novo [`routes/public/payment.ts`](../ifute-core-simple/src/apps/mobile/routes/public/payment.ts):
  `GET /mobile/public/payment/cost-breakdown`, com o mesmo `validateURLQuery("paymentCostBreakdownQuery")`
  e reusando `PaymentService.getCostBreakdown` (handler idêntico — nada de lógica duplicada).
- Montado em [`routes/public/index.ts`](../ifute-core-simple/src/apps/mobile/routes/public/index.ts).
- A rota privada **continua existindo** — as versões do app já publicadas nas lojas chamam ela.

**App (`ifute`)**

- `PaymentAxios.getCostBreakdownPublic` ao lado do método privado.
- `getCostBreakdownAsync` agora recebe `userSignedIn: boolean` e roteia entre público/privado —
  mesmo formato do `getRecurrencyAvailableStartDayAsync`.
- `PreScheduleResume` passa `userSignedIn: !!signedInUser` (e `signedInUser` entrou nas deps do
  effect, então o valor é rebuscado se o usuário logar no meio do fluxo).
- Removido o fallback `?? 0`: enquanto o breakdown não chega, o `Template` mostra `...` em vez de
  `R$ 0,00`. Um zero era lido como preço real; se a busca falhar por qualquer outro motivo
  (rede, 5xx), o usuário vê que o valor está pendente em vez de um preço errado.

### Exposição pública — é seguro?

Sim. O endpoint não lê nem grava nada do usuário: recebe `netValue`/`blocksAppointed`/`paymentType`
e devolve o cálculo da taxa sobre valores que o próprio cliente informou. Não vaza dado de place,
admin ou order. Fica sob o `mobileGlobalRateLimit` como todas as rotas do app, e o validador zod já
rejeita entrada fora de forma (positivos, inteiros, enum de método).

### Verificação

- `tsc --noEmit` limpo nos dois projetos.
- Unit tests: 376 passando (core-simple), 103 passando (app).
- Probe local do router Express (sem banco), confirmando o roteamento:
  - `GET /mobile/private/payment/cost-breakdown` sem token → **401** (`Usuário não autenticado`)
  - `GET /mobile/public/payment/cost-breakdown?netValue=100&blocksAppointed=2&paymentType=pix` →
    passa auth e validação, chega no handler
  - `GET /mobile/public/payment/cost-breakdown` sem query → **400** do zod
- Sem migration, sem mudança de env, sem mudança de contrato de resposta.

### Deploy

1. `ifute-core-simple` primeiro (`./scripts/release.sh ifute-core-simple` de dentro de
   `ifute-compose`, com bump de versão antes). Sem migration a rodar.
2. Depois a build do app. **Os apps já instalados só param de mostrar R$ 0,00 quando atualizarem** —
   eles chamam a rota privada, e a única forma de consertá-los sem release seria afrouxar o auth de
   `/private`, o que não faz sentido.

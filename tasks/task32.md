# Task 32 — Eventos de negócio em tabela (gap G8)

## Problema

Evento de negócio hoje só existe em **log de container**, que rotaciona. A consequência já é concreta, não hipotética:

- O journald da VPS está no **teto de 250 MB** (`SystemMaxUse=250M`), não nos ~28 dias que a configuração sugere. Medição de 16/08/2026: `journalctl --disk-usage` = **249,9 MB**, entrada mais antiga de 10/08 20:51 BRT — janela real de **~6 dias**, rolando para frente.
- O `ifute-jobber` responde por **41% dos bytes** do log do core (um `POST /webhook/internal/stripe` por minuto, 24h/dia). É ele quem empurra o sinal real para fora.
- **Já perdemos dado:** a coordenada `-28.28, -54.26` aparecia nos relatórios de 10, 12 e 13/08 e não existe mais em lugar nenhum além daqueles markdowns.

É o gap **G8** da [seção 8 do relatório de 08/08](../reports/historico/2026-08-08-rastreio-usuario-prod.md). Sua consequência prática mais visível é o [`reports/demanda-organica.md`](../reports/demanda-organica.md): um documento **mantido à mão** só porque não há onde consultar o histórico.

Fecha também, de lambuja, a maior parte do **G4** (eventos de autenticação não são logados) — hoje a única forma de datar um cadastro é o `created_at` da tabela `user`.

## Decisão central: tabela de eventos, não log

Log rotativo serve para **depurar**; tabela serve para **analisar**. A separação é a regra que faz esta task não virar um Datadog ruim dentro do Postgres:

| Vai para a tabela | Continua só no log |
|---|---|
| Evento de **negócio**: busca, cadastro, login | Log de acesso (`Request completed`) |
| Baixo volume, alto valor por linha | Alto volume, valor efêmero |
| Consultado em meses | Consultado em horas |

**O jobber não entra.** Ele é 41% do volume e não é comportamento de ninguém.

### Por que não as alternativas

- **Aumentar `SystemMaxUse`** — adia o problema e não dá consulta; log continua sendo grep. Vale como paliativo (ver "Paliativo" no fim), não como solução.
- **Analytics no app (G9)** — SDK, consentimento, política de privacidade, e responde sobre telas, não sobre o que o backend viu. Mais caro e resolve outra pergunta.
- **Coletor externo (Loki/ELK)** — infra nova numa VPS limitada. O CLAUDE.md do ecossistema veta explicitamente.

## Schema

```sql
business_event
  id           uuid          pk   default gen_random_uuid()
  event        varchar       not null    -- 'place_search' | 'user_signup' | 'user_login'
  occurred_at  timestamptz   not null    default now()
  user_id      uuid          null        -- nulo em rota pública
  request_id   varchar       null        -- amarra com o log de debug enquanto ele existir
  lat          numeric(6,2)  null        -- já arredondado (~1 km), como no log
  lon          numeric(6,2)  null
  payload      jsonb         null        -- contagens do funil, provider, rota

INDEX IDX_business_event_event_occurred_at (event, occurred_at)
```

Decisões e seus porquês:

- **`lat`/`lon` são colunas, não `payload`.** São a dimensão analítica primária (o mapa de prospecção é `GROUP BY lat, lon`); em JSONB exigiriam cast em toda consulta. Continuam arredondados a 2 casas pelo mesmo `roundCoordinateForLog` do log — a garantia de LGPD é a mesma, e não há motivo para a tabela ser mais precisa que o log.
- **`numeric(6,2)`, não `float`.** Coordenada arredondada é valor decimal exato; `float` reintroduziria `-22.960000000000001` e quebraria o `GROUP BY`. Usa o `numericColumnTransformer` já existente para hidratar como `number` em JS.
- **Sem foreign key para `user`.** É registro append-only: apagar um usuário não deve apagar a história, e uma FK ou bloquearia a exclusão ou cascatearia o delete. A anonimização (setar `user_id = NULL`) é o caminho correto se um dia houver hard delete — hoje a exclusão de conta é soft (`deleted_at`), então nada a fazer.
- **`payload` como JSONB.** Cada tipo de evento tem campos próprios; colunas dedicadas por evento fariam a tabela crescer em largura a cada evento novo. O que é comum a todos (quando, quem, onde) é coluna; o resto é payload.
- **Um índice só.** Tabela de escrita frequente e leitura rara — `(event, occurred_at)` cobre "eventos do tipo X num intervalo", que é a forma de toda consulta prevista. Não indexar `lat`/`lon`: o volume (27 buscas em 6 dias) não justifica, e índice extra é custo em toda inserção.

### Vocabulário de eventos (fase 1)

| `event` | Quando | `payload` |
|---|---|---|
| `place_search` | Toda busca de local que chega ao fim | `{ route: 'discover' \| 'city', places_in_radius, eligible, results }` |
| `user_signup` | Login que **criou** a conta | `{ provider: 'google' \| 'apple' }` |
| `user_login` | Login de conta que **já existia** | `{ provider: 'google' \| 'apple' }` |

> **Nota sobre o nome.** No log os dois tipos de busca são eventos distintos (`place_discover` e `place_search_city`); na tabela são **um** evento com `payload.route`. A pergunta de negócio é "quantas buscas, onde, quantas vazias" — a rota é detalhe. Vocabulário pequeno importa numa tabela que será consultada por anos.

O `user_signup` carrega `lat`/`lon` porque a rota de login **recebe os headers de geolocalização** (confirmado nos logs de 16/08). Isso é o que torna cada cadastro um ponto no mapa — exatamente o que foi irrecuperável no caso de 08/08.

## Garantias obrigatórias

1. **Nunca quebrar a requisição.** A gravação é fire-and-forget com `.catch()` — se o banco recusar, a busca ainda responde. Analítica não pode derrubar produto.
2. **Nunca bloquear.** Sem `await` no caminho da requisição; a latência do usuário não paga pela métrica.
3. **Não substituir o log.** Os eventos continuam saindo no log também. São canais com tempos de vida diferentes, e o `request_id` amarra os dois enquanto ambos existem.

Perda aceita: um insert em voo se perde se o worker morrer. É analítica, não dinheiro.

## Fases

### Fase 1 — a tabela e os eventos (esta task)

- [x] Entidade `BusinessEvent` + migration `1779000000013-BusinessEvent`
- [x] `Repositories.businessEvent`
- [x] `businessEvent.service.ts` com `recordBusinessEvent()` (fail-safe, não-bloqueante)
- [x] Gravar `place_search` — ponto único: o helper `logPlaceSearch` de `place.service.ts`
- [x] Gravar `user_signup` / `user_login` no login mobile (Google e Apple)
- [x] Unit specs do builder de linha
- [x] Documentar em `ifute-core-simple/CLAUDE.md` (seção Observabilidade)
- [x] **Aplicar a migration num Postgres** (`up` + `revert` + `up`) — ver "Estado" abaixo
- [x] **Deploy em produção** — `0.3.8`, migration aplicada em 17/08/2026

**Fase 1 concluída.** As fases 2 e 3 continuam abertas.

#### Nota de implementação: `save` em vez de `insert`

O `insert` do TypeORM exige `QueryDeepPartialEntity`, que mapeia recursivamente o `Record<string, unknown>` da coluna jsonb e rejeita o payload sem cast. Sem PK definida, o `save` insere direto (não faz SELECT prévio), então o custo é o mesmo e não precisa de cast.

#### Nota de implementação: `AuthResult` nos handlers de auth mobile

`generateGoogeAuthResponseTokenPayload` e `generateAppleAuthResponseTokenPayload` passaram a devolver `{ payload, isNewUser }` em vez de só o payload. O `isNewUser` fica **fora** de `payload` de propósito: o payload é assinado no access token, e um campo analítico não tem por que viajar no JWT. Só os handlers do **mobile** mudaram — backoffice e director têm os seus próprios, fora do escopo.

## Estado — fase 1 em produção (17/08/2026)

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ limpo |
| `npm run test:unit` | ✅ 37 arquivos, 401 testes (era 36/396) |
| Migration `up` → `revert` → `up` | ✅ num Postgres 16.4 descartável |
| Schema conferido | ✅ `numeric(6,2)`, `jsonb`, índice composto |
| Round-trip entidade ↔ tabela | ✅ `lat` hidrata como `number` (`-22.96`), `payload.eligible: 0` preservado |
| Deploy | ✅ `ifute-core-simple:0.3.8`, migration aplicada com backup |
| Gravação em prod | ✅ evento real de app iOS, zero `business_event_write_failed` |

A validação da migration usou um container descartável, sem tocar no banco de dev (que o `npm test` resetaria):

```sh
docker run -d --name ifute-migcheck -e POSTGRES_USER=migcheck \
  -e POSTGRES_PASSWORD=migcheck -e POSTGRES_DB=migcheck -p 55432:5432 postgres:16.4
export POSTGRES_HOST=localhost POSTGRES_PORT=55432 POSTGRES_USER_NAME=migcheck \
       POSTGRES_PASSWORD=migcheck POSTGRES_DATABASE_NAME=migcheck NODE_ENV=lcl
npm run migrations:run && npm run migrations:revert && npm run migrations:run
```

### Fase 2 — consumo ✅

- [x] Endpoint no `backoffice-director` (`GET /director/private/reports/demand?days=30`, teto 365) com `points`, `totals` e `suggestions`
- [x] Tela de demanda no `ifute-master-backoffice` (`/dashboard/demand`)
- [x] `reports/demanda-organica.md` deixa de ser levantado à mão — vira leitura da tela

**Agregação em SQL, não em JS.** O `director.service` carrega orders e soma em memória porque precisa reutilizar `computeOrderFinancials` (regra de negócio em JSON aninhado). Aqui não há regra a reutilizar — é `count(*) filter (...)` + `GROUP BY lat, lon` sobre colunas indexadas. Carregar linhas para contar só cresceria com o tempo sem ganho.

**Rótulo de região resolvido no backend** ([`cityLabel.ts`](../ifute-core-simple/src/shared/utils/helpers/cityLabel.ts)), tabela offline + haversine. Reverse geocoding por ponto custaria latência e cota para rotular dezenas de agregados, e a precisão guardada é ~1 km de todo modo. O `analyze-prod-logins.mjs` mantém a cópia dele para uso offline sem API — duplicação consciente, o backend é a fonte de verdade.

### Fase 3 — cobertura do funil ✅

- [x] Eventos de order (`order_created`, `order_paid`, `order_canceled`) com `reason` no cancelamento
- [x] `place_suggestion` — `POST /mobile/public/place/suggestion`, rota pública, geolocalização opcional
- [x] Signup/login de admin (`admin_signup`, `admin_login`) no backoffice e no director

> **O buraco que motivou esta fase.** Em 17/08 às 09:17, logo após o deploy da fase 1, uma sessão de app iOS buscou quadras, **abriu duas delas e consultou preço** (`/payment/cost-breakdown`) — os passos mais próximos de uma reserva. Só a busca virou linha. Pelo `business_event` isolado, a sessão lia como "buscou e sumiu". Com os eventos de order, o funil passa a medir topo **e** fundo.

**Decisões:**

- **`recordOrderEvent` em vez de chamadas soltas.** São 5 call sites em 3 arquivos; payload montado à mão em cada um divergiria, e num registro append-only divergência é dado perdido, não bug corrigível.
- **`reason` obrigatório no cancelamento.** Desistência de jogador, falha nossa ao materializar agendamento e estorno do provider têm naturezas opostas — somados na mesma contagem, o número não decide nada.
- **Evento após o `commit`, nunca dentro da transação.** No cancelamento pelo app, emitir dentro do `try` deixaria evento fantasma num rollback.
- **`place_suggestion` é rota pública com geo opcional.** 4 dos 6 pontos do mapa nunca criaram conta; exigir login perderia quem mais interessa. E quem negou a permissão de localização ainda indica — nome da quadra sozinho já é lead.
- **`has_referrer` vem do retorno de `attachReferrerOnSignup`**, não de "veio código na URL": o método rejeita silenciosamente código inválido e auto-afiliação, então só o retorno diz se o padrinho existe de fato. Mede o funil de afiliação sem varrer o banco.

### O que segue fora do escopo

- **Tela vazia no app mobile** (`ifute/`) que consome o `POST /place/suggestion`. O backend está pronto e esperando; a tela é trabalho de produto/UX em outro repositório.
- Job de retenção da tabela.
- Eventos de saque/settlement.

## A regra que não pode ser afrouxada

**Só entra evento de negócio.** Baixo volume, alto valor por linha, consultado em meses. Log de acesso e tráfego de automação **não entram** — o `ifute-jobber` sozinho é ~41% do volume do log, e colocá-lo aqui faria da tabela um coletor de logs ruim dentro do Postgres. A retenção automática continua fora de escopo justamente porque, respeitada essa regra, o volume não a exige.

## Paliativo independente

Cortar o log do webhook interno do jobber libera **~41% do volume** do log do core na hora e multiplica a janela de retenção, sem tocar em código de domínio. Não substitui esta task — só para de sangrar sinal enquanto ela não está em produção.

## Como validar

```sh
# Local: migration aplica e reverte limpo
npm run migrations:run && npm run migrations:revert && npm run migrations:run

# Unit
npm run test:unit

# Manual: uma busca vazia vira uma linha
curl -s localhost:7100/mobile/public/place/discover \
  -H 'lat: -22.96' -H 'lon: -43.17' -H 'day: 2026-08-17' -H 'timezoneoffset: 180'
psql -c "select event, lat, lon, payload from business_event order by occurred_at desc limit 5;"
```

Em produção, após o release: `./scripts/migrate-prd.sh` é **obrigatório** (migrations não rodam no boot em prd).

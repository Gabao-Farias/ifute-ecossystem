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
- [ ] **Aplicar a migration num Postgres** (`up` + `revert` + `up`) — ⚠️ **ainda não verificado**, ver "Estado" abaixo

#### Nota de implementação: `save` em vez de `insert`

O `insert` do TypeORM exige `QueryDeepPartialEntity`, que mapeia recursivamente o `Record<string, unknown>` da coluna jsonb e rejeita o payload sem cast. Sem PK definida, o `save` insere direto (não faz SELECT prévio), então o custo é o mesmo e não precisa de cast.

#### Nota de implementação: `AuthResult` nos handlers de auth mobile

`generateGoogeAuthResponseTokenPayload` e `generateAppleAuthResponseTokenPayload` passaram a devolver `{ payload, isNewUser }` em vez de só o payload. O `isNewUser` fica **fora** de `payload` de propósito: o payload é assinado no access token, e um campo analítico não tem por que viajar no JWT. Só os handlers do **mobile** mudaram — backoffice e director têm os seus próprios, fora do escopo.

## Estado

Implementado e verificado até onde a máquina local permite:

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ limpo |
| `npm run test:unit` | ✅ 37 arquivos, 401 testes (era 36/396) |
| Migration aplicada num banco | ❌ **não rodou** — sem Docker e sem Postgres local nesta máquina |

A migration usa a mesma API (`Table` + `TableIndex`) da `1779000000011-PlatformWithdrawal`, e o `tsc` valida a forma das opções (`precision`/`scale` existem em `TableColumnOptions` no TypeORM 0.3.22) — mas **isso não substitui aplicá-la**. Rodar antes do release:

```sh
npm run migrations:run && npm run migrations:revert && npm run migrations:run
```

### Fase 2 — consumo (fora desta task)

- Endpoint no `backoffice-director` (`/director/private/reports/demand`) com o mapa agregado
- Tela de demanda no `ifute-master-backoffice`
- Transformar o `reports/demanda-organica.md` de documento manual em consulta

### Fase 3 — o que a tabela habilita (fora desta task)

- Eventos de order (`order_created`, `order_paid`, `order_canceled`) → funil de conversão real
- `place_suggestion` — o "indique sua quadra" da tela vazia, que precisa exatamente desta tabela
- Signup de admin (backoffice/director), hoje fora do escopo

## Escopo explicitamente fora

- Retenção automática / job de limpeza. O volume não justifica ainda; a decisão de retenção deve ser tomada quando houver ordem de grandeza para ela.
- Eventos de admin (backoffice e director têm handlers de auth próprios).
- Qualquer coisa que grave log de acesso na tabela.

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

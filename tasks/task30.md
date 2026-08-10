# Task 30 — Observabilidade de requisição (G1, G2, G3, G6, G7)

## Origem

O [relatório de rastreio de 2026-08-08](../reports/2026-08-08-rastreio-usuario-prod.md) tentou
responder "o que este usuário fez na plataforma?" e só conseguiu por **inferência temporal**:
casar o `created_at` da tabela `user` com o `POST /auth/login/google` no access log do nginx, e daí
extrair a sessão pelo IP. Funcionou porque havia 2 IPs ativos no dia. Com tráfego real, não
funcionaria.

O log de requisição registrava apenas `{ip, path}`. Grep por e-mail ou `user_id` retornava zero, a
localização que o app envia em headers era descartada, e a única forma de detectar uma busca vazia
era forense — contar os 2 bytes de `[]` no `$body_bytes_sent` do nginx.

A seção 8 do relatório listou 9 gaps. Esta task cobre **cinco**: G1, G2, G3, G6 e G7.

## Decisões

- **Log de acesso emitido no fim da requisição**, não na entrada. O `loggerMiddleware` é global e
  roda antes do `authenticateToken`, então na entrada `req.user` não existe. Esperar o fim foi o que
  permitiu ter `user_id` sem um segundo middleware por app — e trouxe `status`, `duration_ms` e
  `aborted` de graça. Usa `close` e não `finish` para que requisição abandonada também vire log.
  Custo: uma requisição que nunca termina deixa de aparecer. Em troca, o volume de linhas não dobra.
- **Coordenadas arredondadas a 2 casas (~1 km).** Coordenada exata de pessoa física é dado pessoal
  sob LGPD e a linha vai para log de container. ~1 km basta para agregar demanda por cidade/bairro e
  não localiza ninguém. Resolver coordenada → nome de cidade é trabalho da análise: chamar o reverse
  geocoding da OpenWeatherMap por requisição custaria latência e cota.
- **Três contagens no funil de busca, não uma.** `places_in_radius = 0` (falta de oferta) e
  `eligible = 0` com `places_in_radius > 0` (falta de ativação) pedem ações de negócio diferentes.
- **`request_id` gerado no nginx, propagado por `AsyncLocalStorage`.** O nginx tem `$request_id`
  nativo, então não havia id para inventar. O trabalho real era fazê-lo chegar aos ~90 pontos de log
  dos apps sem passá-lo como parâmetro em todos eles — resolvido com o `mixin` do pino.
- **Sem tabela de eventos** (G8) e **sem analytics no app** (G9). Ficaram de fora por terem
  implicação de privacidade e decisão de produto.

## O que foi implementado

### `ifute-core-simple` ([#114](https://github.com/Gabao-Farias/ifute-core-simple/pull/114), [#115](https://github.com/Gabao-Farias/ifute-core-simple/pull/115), [#116](https://github.com/Gabao-Farias/ifute-core-simple/pull/116))

| Arquivo | Mudança |
|---|---|
| `src/shared/middlewares/log.ts` | Linha única por requisição no `res.on("close")`, com `request_id`, `user_id`, `status`, `duration_ms`, `aborted`, `lat`/`lon`/`tz_offset`. Abre o contexto de requisição e devolve `X-Request-Id` ao cliente |
| `src/shared/utils/helpers/geo.ts` (novo) | `roundCoordinateForLog` (2 casas) e `geoLogContextFromHeaders` |
| `src/shared/utils/helpers/requestContext.ts` (novo) | `AsyncLocalStorage` do `request_id` + `resolveRequestId` (valida header externo) |
| `src/shared/utils/helpers/logger.ts` | `mixin` do pino injeta `request_id` em toda linha; `userIdForLog` garante escalar |
| `src/apps/mobile/services/place.service.ts` | Eventos `place_discover` e `place_search_city` com `places_in_radius`/`eligible`/`results` |
| `src/apps/webhook/middlewares/internal.ts` | Correção: `req.user = user` (não `{ sub: user }`) |

### `ifute-compose` ([#14](https://github.com/Gabao-Farias/ifute-compose/pull/14), [#15](https://github.com/Gabao-Farias/ifute-compose/pull/15))

| Arquivo | Mudança |
|---|---|
| `nginx/conf.d/00-logging.conf` (novo) | `log_format main_timed` = `main` de fábrica + `rt=`, `urt=`, `rid=` |
| `nginx/conf.d/default.conf` | `access_log main_timed` por server block; `proxy_set_header X-Request-Id $request_id` nos 4 locations proxiados |

## Gaps fechados

| Gap | O que faltava | Como ficou |
|---|---|---|
| **G1** | `user_id` no log | Presente em toda rota `private` |
| **G2** | headers de geolocalização descartados | `lat`/`lon` (2 casas) + `tz_offset` |
| **G3** | buscas vazias não medidas | Eventos `place_discover`/`place_search_city` com o funil de 3 contagens |
| **G6** | sem id de correlação | `request_id` da borda ao core; `pid` o pino já emitia |
| **G7** | sem métrica de latência | `rt=`/`urt=` no nginx + `duration_ms` no core |

Continuam abertos: **G4** (eventos de auth), **G5** (`401` ambíguos), **G8** (retenção/tabela de
eventos), **G9** (analytics no app).

## Formato resultante

```
# nginx
189.7.228.9 - - [09/Aug/2026:16:59:05 +0000] "GET /mobile/public/place/discover HTTP/1.1" 200 2 "-" "curl/8.7.1" "-" rt=0.029 urt="0.030" rid=d1319181f36a2b02ccae140286eae196

# core — mesma requisição, mesmo worker, duas linhas correlacionadas
{"pid":20,"request_id":"d1319181f36a2b02ccae140286eae196","event":"place_discover","lat":-23.56,"lon":-46.66,"tz_offset":180,"places_in_radius":0,"eligible":0,"results":0,"msg":"place_discover"}
{"pid":20,"request_id":"d1319181f36a2b02ccae140286eae196","ip":"189.7.228.9","path":"/mobile/public/place/discover","method":"GET","status":200,"duration_ms":29,"lat":-23.56,"lon":-46.66,"tz_offset":180,"msg":"Request completed"}
```

## Consultas que passaram a existir

```sh
# Tudo que um usuário fez
docker logs ifute-core-simple 2>&1 | grep '"user_id":"<uuid>"'

# Uma requisição inteira, da borda ao core
docker logs nginx_proxy       2>&1 | grep '<request_id>'
docker logs ifute-core-simple 2>&1 | grep '"request_id":"<request_id>"'

# Mapa de demanda não atendida (onde procuram e não acham)
docker logs ifute-core-simple 2>&1 | grep '"event":"place_' | grep '"eligible":0'

# Rotas mais lentas (urt = tempo do backend, isolado da rede do cliente)
docker logs nginx_proxy 2>&1 | grep -o 'urt="[0-9.]*"' | sort -t'"' -k2 -rn | head
```

## Armadilhas encontradas

**Ordem do `include` do nginx.** O `log_format` estava em `security.conf` e o boot quebrou com
`unknown log format "main_timed"`: `include /etc/nginx/conf.d/*.conf` resolve o glob em ordem
alfabética, então `default.conf` era lido primeiro. Daí o prefixo numérico em `00-logging.conf`.
Vale para qualquer diretiva `http{}` futura que os server blocks consumam.

**`access_log` em `http{}` é aditivo.** O `nginx.conf` da imagem já declara
`access_log ... main;` antes do include; redeclarar em nível de `http{}` adiciona um **segundo
destino** (cada requisição sairia duplicada no mesmo arquivo) em vez de substituir. Em nível de
server, substitui. Por isso a diretiva está repetida nos server blocks.

**`user_id` como objeto.** O primeiro tráfego real depois do release `0.3.5` mostrou
`"user_id":{"sub":"…"}` nas chamadas do jobber — o middleware do webhook interno embrulhava o
payload já verificado em `{ sub: user }`. Bug pré-existente e invisível (nenhum handler lia o
campo), que só apareceu quando o log passou a emiti-lo. Corrigido no `0.3.6`, com `userIdForLog`
como defesa em profundidade: campo cuja razão de existir é ser greppável não deve aceitar objeto.

**Header de terceiro é entrada não confiável.** Aceitar `X-Request-Id` do cliente sem validar
permite injetar linhas de log forjadas via quebra de linha. O nginx sobrescreve o header em tráfego
proxiado, e o core valida de novo (`[A-Za-z0-9._-]{1,64}`) porque também recebe tráfego interno.

## Custo em performance

O gargalo da infra é CPU do Node (task 26), então o `AsyncLocalStorage` foi medido, não estimado.
A/B do middleware pré-G6 contra o atual, ambos recebendo `x-request-id` como o nginx sempre manda:

| | req/s |
|---|---|
| pré-G6 | 9026 |
| com G6 | 8485 |
| variação | −6,0% |

Em absoluto, **~7 µs por requisição**. No teto real da infra (~150 req/s agregados) isso é ~0,1% de
um core — desprezível perto do trabalho de banco de cada request. O −6% só aparece porque o
benchmark serve rota vazia a ~9k req/s, onde o middleware é praticamente todo o trabalho.

## Deploy

Sem migrations. Releases `0.3.5` (G1/G2/G3) e `0.3.6` (G6 + correção do `user_id`) via
`release.sh ifute-core-simple`, seguidos de `deploy-prd.sh` para a configuração do nginx — nessa
ordem, porque o `deploy-prd.sh` recria o nginx e é ele quem passa a valer no fim.

> `deploy-prd.sh` exige `.env.ifute-core-simple` e `.env.ifute-jobber` na raiz do `ifute-compose/`.
> Eles são gitignored e moram no repo separado `ifute-envs/` — copiar antes de rodar, senão o script
> aborta no `cp`.

## O que isto não resolve

A ação nº 1 do relatório continua de pé e é mais importante que todo o resto: **não há uma única
quadra real cadastrada em produção**. Verificado de novo após o deploy — `discover` com coordenadas
de São Paulo devolve `places_in_radius: 0`. Nenhuma instrumentação muda o fato de que 100% dos
usuários reais veem tela vazia; o que ela dá agora é o mapa de onde essa demanda está.

Ponto cego remanescente: `/place/discover` e `/place/city` são rotas **públicas** — o app as chama
mesmo logado, então esses eventos não têm `user_id`. Dá para saber *de onde* veio a busca vazia, não
*de quem*. Fechar exigiria decodificar o JWT sem verificar (dado não confiável em log) ou mover as
rotas para `private`.

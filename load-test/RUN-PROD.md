# Runbook — executar o teste em produção

Passo-a-passo para você rodar. Total ~30–40 min incluindo release e reversão.
Escolha uma **janela de baixo tráfego** (madrugada). O patch do bypass já está
aplicado no código (inerte enquanto a env não estiver setada).

## 0. Descobrir o IP público do gerador

Na máquina que vai rodar o k6:

```bash
curl -s https://api.ipify.org; echo
```

Guarde esse IP.

## 1. Configurar o `.env` de prod (no host, via ifute-compose)

No `.env` do core em produção, setar/append:

```
RATE_LIMIT_BYPASS_TOKEN=<gere-um-segredo-forte>   # ex: openssl rand -hex 24
WHITELIST_IPS=<...ips-já-existentes...>,<IP-do-gerador>
```

> `WHITELIST_IPS` isenta o IP da blocklist de scanners. `RATE_LIMIT_BYPASS_TOKEN`
> liga o `skip` do rate limiter só pra quem mandar o header com esse valor.

## 2. Releasar o core com o patch

Bumpe a versão e releasse (o patch está em `rateLimit.ts` + `env.ts`):

```bash
cd ifute-core-simple
npm version patch --no-git-tag-version
git add -A && git commit -m "loadtest: bypass reversível de rate limit"
cd ../ifute-compose
./scripts/release.sh ifute-core-simple
# se o app servir 502 logo após: nginx -s reload no host (DNS defasado)
```

Como só mudou o `.env` (tokens) e não o compose, se a imagem já tem o patch você
pode alternativamente usar `./scripts/deploy-prd.sh` para recriar com o novo
`.env`. Confirme que o container subiu com a env nova.

## 3. Confirmar que o bypass funciona (2 requests manuais)

```bash
BASE=https://api.ifute.com.br
DAY=$(python3 -c "import datetime;print(datetime.datetime.utcnow().isoformat()+'Z')")
# Sem o header: deve responder normal (e contar pro rate limit)
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/mobile/public/place/discover" \
  -H "day: $DAY" -H "timezoneoffset: -180" -H "lat: -54.441196" -H "lon: -36.554195"
# Com o header + token: idem, mas isento do limite
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/mobile/public/place/discover" \
  -H "day: $DAY" -H "timezoneoffset: -180" -H "lat: -54.441196" -H "lon: -36.554195" \
  -H "x-loadtest-bypass: <RATE_LIMIT_BYPASS_TOKEN>"
```

Ambos devem dar `200`. Para provar o bypass, dispare >50 requests rápidos com o
header e confirme que **nenhum** volta com a mensagem de quota excedida.

## 4. Iniciar o monitor na VPS (sessão SSH)

```bash
# na VPS, no diretório onde estão os scripts (copie monitor-host.sh pra lá)
./monitor-host.sh <container-postgres> 5 | tee monitor-$(date +%s).log
```

Descubra o nome do container com `docker ps` (procure o serviço postgres). Ajuste
`PG_USER`/`PG_DB` via env se não forem `postgres`/`ifute`.

## 5. Rodar o k6 (máquina do gerador)

```bash
cd load-test
BASE_URL=https://api.ifute.com.br \
PLACE_ID=<uuid-place-teste-atlantico> \
JWT=<token-mobile> \
BYPASS_TOKEN=<RATE_LIMIT_BYPASS_TOKEN> \
PEAK_RPS=300 \
k6 run read-path.js
```

- `PLACE_ID`: pegue o UUID de um Place de teste (coords Atlântico) — via backoffice
  ou `SELECT place_id FROM place_location WHERE lat=-54.441196 LIMIT 1;`.
- `JWT`: `AUTHORIZED_TEST_TOKEN` do `.env` ou `npm run tools:testjwt`.
- Se `PEAK_RPS=300` passar folgado nos thresholds, suba (ex: 600, 1000) e repita.
  O teto é o `PEAK_RPS` onde `http_req_failed` passa de 1% ou p95 estoura.

O k6 grava `results/loadtest-<ts>.md` e `.json` automaticamente.

## 6. Reverter (OBRIGATÓRIO após o teste)

```bash
# no .env de prod: remover RATE_LIMIT_BYPASS_TOKEN e tirar o IP do WHITELIST_IPS
cd ifute-compose && ./scripts/deploy-prd.sh   # recria com o .env limpo
```

Com `RATE_LIMIT_BYPASS_TOKEN` vazia o `skip` volta a ser no-op — o rate limit de
50 req/min está de novo 100% ativo. No próximo ciclo, opcionalmente reverta o
patch de `rateLimit.ts`/`env.ts` também.

## 7. Fechar o relatório

Me mande `results/loadtest-<ts>.md` + o `monitor-*.log`. Eu preencho a tabela de
correlação com o host e escrevo a leitura final (teto observado + gargalo).

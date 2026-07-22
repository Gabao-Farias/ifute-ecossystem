// Teste de carga — CAMINHO A (leitura) do app mobile do iFute.
//
// Objetivo: achar o TETO de throughput da infra atual (VPS única) medindo os
// endpoints de leitura, que são a maioria absoluta do tráfego real. NÃO toca
// Asaas e NÃO escreve no banco.
//
// Usa o executor `ramping-arrival-rate`: k6 empurra uma taxa-alvo de req/s
// (independente da latência) e aloca VUs conforme necessário. Isso revela o
// ponto de saturação — quando a taxa observada para de acompanhar o alvo e/ou
// p95 e erros disparam, você achou o teto.
//
// Pré-requisitos (ver README.md): rodar em JANELA DE BAIXO TRÁFEGO, com o IP do
// gerador isento do rate limit (BYPASS_TOKEN) e da blocklist (WHITELIST_IPS).
// Sem isso você mede a proteção, não a infra.
//
// Uso:
//   BASE_URL=https://api.ifute.com.br \
//   PLACE_ID=<uuid-de-um-place-de-teste-no-atlantico> \
//   JWT=<token-mobile> \
//   BYPASS_TOKEN=<segredo-do-skip-do-rate-limit> \
//   PEAK_RPS=300 \
//   k6 run read-path.js

import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

const BASE_URL = __ENV.BASE_URL || 'https://api.ifute.com.br';
const PLACE_ID = __ENV.PLACE_ID || '';
const JWT = __ENV.JWT || '';
const BYPASS_TOKEN = __ENV.BYPASS_TOKEN || '';
const PEAK_RPS = Number(__ENV.PEAK_RPS || 300);

// Places de teste em prod ficam no meio do Atlântico Sul (convenção do repo).
// Mirar aqui garante que a carga não interfere em busca de usuário real.
const LAT = __ENV.LAT || '-54.441196';
const LON = __ENV.LON || '-36.554195';
const TZ_OFFSET = __ENV.TZ_OFFSET || '-180'; // BRT

// Métricas por-endpoint pra ver qual satura primeiro.
const tDiscover = new Trend('lat_discover', true);
const tCity = new Trend('lat_city', true);
const tDetails = new Trend('lat_details', true);
const tCost = new Trend('lat_cost_breakdown', true);

export const options = {
  // Percentis extras no summary (o default não traz p50/p99).
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    read_ramp: {
      executor: 'ramping-arrival-rate',
      startRate: 20, // req/s inicial
      timeUnit: '1s',
      preAllocatedVUs: 300,
      maxVUs: 2500, // teto de VUs; se bater aqui, a latência estourou — é sinal
      stages: [
        { target: 100, duration: '30s' }, // aquecimento
        { target: 300, duration: '1m' },
        { target: 600, duration: '1m' },
        { target: 1000, duration: '1m' },
        { target: 1500, duration: '1m' },
        { target: PEAK_RPS, duration: '1m30s' }, // empurra até o pico
        { target: PEAK_RPS, duration: '1m' }, // sustenta no pico
        { target: 0, duration: '30s' }, // ramp-down
      ],
    },
  },
  thresholds: {
    // Quando estes quebram = teto de capacidade atingido.
    http_req_failed: ['rate<0.01'], // < 1% de erro
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    lat_discover: ['p(95)<800'],
    lat_details: ['p(95)<800'],
  },
};

function commonHeaders() {
  const h = {
    day: new Date().toISOString(),
    timezoneoffset: TZ_OFFSET,
  };
  // Header secreto que o middleware de rate limit vai honrar pra PULAR o limite
  // (ver patch no README). Só surte efeito com RATE_LIMIT_BYPASS_TOKEN setado no
  // backend durante a janela de teste.
  if (BYPASS_TOKEN) h['x-loadtest-bypass'] = BYPASS_TOKEN;
  return h;
}

function geoHeaders() {
  return Object.assign(commonHeaders(), { lat: LAT, lon: LON });
}

export default function () {
  // Mix ponderado imitando comportamento real: muito discover/detalhe, pouco
  // city, e cost-breakdown só quando o usuário já está montando uma reserva.
  const r = Math.random();

  if (r < 0.45) {
    const res = http.get(`${BASE_URL}/mobile/public/place/discover`, {
      headers: geoHeaders(),
      tags: { ep: 'discover' },
    });
    tDiscover.add(res.timings.duration);
    check(res, { 'discover 2xx': (x) => x.status === 200 });
  } else if (r < 0.85 && PLACE_ID) {
    const res = http.get(
      `${BASE_URL}/mobile/public/place/?place_id=${PLACE_ID}`,
      { headers: commonHeaders(), tags: { ep: 'details' } }
    );
    tDetails.add(res.timings.duration);
    check(res, { 'details 2xx': (x) => x.status === 200 });
  } else if (r < 0.95) {
    const res = http.get(`${BASE_URL}/mobile/public/place/city`, {
      headers: geoHeaders(),
      tags: { ep: 'city' },
    });
    tCity.add(res.timings.duration);
    check(res, { 'city 2xx': (x) => x.status === 200 });
  } else if (JWT) {
    const res = http.get(
      `${BASE_URL}/mobile/private/payment/cost-breakdown?netValue=5000&blocksAppointed=2&paymentType=pix`,
      {
        headers: Object.assign(commonHeaders(), {
          Authorization: `Bearer ${JWT}`,
        }),
        tags: { ep: 'cost' },
      }
    );
    tCost.add(res.timings.duration);
    check(res, { 'cost 2xx': (x) => x.status === 200 });
  }
}

// --- Relatório datado gerado automaticamente ao fim do teste ---
// Escreve results/loadtest-<ts>.md (legível) e .json (bruto) em ./load-test/results.
// O timestamp usa new Date() (disponível no runtime do k6).

function fmt(v, unit) {
  if (v === undefined || v === null || Number.isNaN(v)) return '—';
  return `${Math.round(v)}${unit || ''}`;
}

function pct(m, key) {
  return m && m.values ? fmt(m.values[key], 'ms') : '—';
}

function thresholdLines(metrics) {
  const lines = [];
  for (const name of Object.keys(metrics)) {
    const th = metrics[name].thresholds;
    if (!th) continue;
    for (const expr of Object.keys(th)) {
      const ok = th[expr].ok !== false;
      lines.push(`| \`${name}\` | \`${expr}\` | ${ok ? '✅ passou' : '❌ ESTOUROU'} |`);
    }
  }
  return lines.length ? lines.join('\n') : '| — | — | — |';
}

export function handleSummary(data) {
  const m = data.metrics || {};
  const iso = new Date().toISOString();
  const ts = iso.replace(/:/g, '').replace(/\..+/, 'Z').replace('T', '_');

  const reqs = m.http_reqs && m.http_reqs.values;
  const failed = m.http_req_failed && m.http_req_failed.values;
  const vus = m.vus_max && m.vus_max.values;

  const endpoints = [
    ['discover', m.lat_discover],
    ['detalhes place', m.lat_details],
    ['city', m.lat_city],
    ['cost-breakdown', m.lat_cost_breakdown],
  ];

  const epRows = endpoints
    .filter(([, met]) => met && met.values)
    .map(([label, met]) => {
      const v = met.values;
      return `| ${label} | ${fmt(v.med, 'ms')} | ${fmt(v['p(90)'], 'ms')} | ${fmt(v['p(95)'], 'ms')} | ${fmt(v['p(99)'], 'ms')} | ${fmt(v.max, 'ms')} |`;
    })
    .join('\n') || '| — | — | — | — | — | — |';

  const md = `# Teste de carga — Caminho A (leitura) — ${iso}

Gerado automaticamente pelo k6 (\`read-path.js\`).

## Configuração da execução

| Parâmetro | Valor |
|---|---|
| Alvo (\`BASE_URL\`) | \`${__ENV.BASE_URL || 'https://api.ifute.com.br'}\` |
| Pico alvo (\`PEAK_RPS\`) | ${__ENV.PEAK_RPS || 300} req/s |
| \`PLACE_ID\` informado | ${__ENV.PLACE_ID ? 'sim' : 'não (endpoint de detalhes pulado)'} |
| \`JWT\` informado | ${__ENV.JWT ? 'sim' : 'não (cost-breakdown pulado)'} |
| Bypass rate limit | ${__ENV.BYPASS_TOKEN ? 'ativo (header enviado)' : 'AUSENTE — provável saturação do rate limiter, não da infra'} |
| Início (UTC) | ${iso} |

## Resultado geral

| Métrica | Valor |
|---|---|
| Total de requests | ${fmt(reqs && reqs.count, '')} |
| Throughput médio observado | ${reqs ? (Math.round(reqs.rate * 10) / 10) : '—'} req/s |
| Taxa de erro (\`http_req_failed\`) | ${failed ? (Math.round(failed.rate * 10000) / 100) + '%' : '—'} |
| VUs máximos alocados | ${vus ? fmt(vus.max || vus.value, '') : '—'} |
| \`http_req_duration\` p50 (mediana) | ${pct(m.http_req_duration, 'med')} |
| \`http_req_duration\` p90 | ${pct(m.http_req_duration, 'p(90)')} |
| \`http_req_duration\` p95 | ${pct(m.http_req_duration, 'p(95)')} |
| \`http_req_duration\` p99 | ${pct(m.http_req_duration, 'p(99)')} |
| \`http_req_duration\` max | ${pct(m.http_req_duration, 'max')} |

## Latência por endpoint

| Endpoint | p50 | p90 | p95 | p99 | max |
|---|---|---|---|---|---|
${epRows}

## Thresholds (teto de capacidade)

Quando algum destes **ESTOUROU**, você passou do ponto de saturação sustentável.

| Métrica | Regra | Status |
|---|---|---|
${thresholdLines(m)}

## Correlação com o host (preencher a partir de \`monitor-*.log\`)

> Cole aqui os números do \`monitor-host.sh\` no instante em que a latência/erros
> dispararam. Objetivo: identificar o recurso que saturou primeiro.

| Recurso | Valor no pico | Saturou? |
|---|---|---|
| CPU load (1min) | | |
| Postgres conns / max_connections | | |
| Postgres queries ativas | | |
| Query ativa mais antiga (s) | | |
| Mem usada / livre | | |

## Leitura / conclusão

- **Teto observado:** ~____ req/s antes de erro > 1% ou p95 > 800ms.
- **Gargalo primário:** ____ (hipótese do repo: Postgres/pool de conexões antes da CPU).
- **Próximo passo:** ____ (ex: tuning de \`max_connections\`/pool do TypeORM, índices, cache).

---
_k6 ${(data.k6 && data.k6.version) || ''} — arquivo bruto: \`loadtest-${ts}.json\`_
`;

  const out = {};
  out[`results/loadtest-${ts}.md`] = md;
  out[`results/loadtest-${ts}.json`] = JSON.stringify(data, null, 2);
  out['stdout'] = textSummary(data, { indent: ' ', enableColors: true });
  return out;
}

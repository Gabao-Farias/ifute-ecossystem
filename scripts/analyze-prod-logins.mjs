#!/usr/bin/env node
/**
 * analyze-prod-logins.mjs — relatório de logins, rotas e localização a partir
 * dos logs de produção.
 *
 * Script estático: sem dependências (Node >= 18), sem estado, sem escrever nada
 * no servidor. Só lê logs (journald) e cospe um markdown em `reports/historico/`
 * (snapshots datados; a raiz de `reports/` é dos documentos vivos, mantidos à
 * mão — ver `reports/demanda-organica.md`).
 *
 * Fontes (as duas via journald, que retém ~28 dias — ver ifute-compose/README):
 *   - CONTAINER_TAG=ifute-core-simple  -> linhas JSON do pino ("Request completed")
 *   - CONTAINER_TAG=nginx              -> access log (traz o User-Agent)
 *
 * As duas se ligam pelo `request_id` (`rid=` no nginx), então o UA do nginx
 * enriquece a linha do core sem depender de correlação por timestamp.
 *
 * Como o login é rota PÚBLICA, a linha do próprio login não tem `user_id` (o
 * `authenticateToken` não roda nela). A atribuição é feita por IP + janela de
 * tempo: o primeiro request autenticado do mesmo IP, no mesmo app, depois do
 * login. Logins que não casam ficam explicitamente marcados como não atribuídos
 * — o relatório nunca "chuta" um usuário.
 *
 * Uso:
 *   node scripts/analyze-prod-logins.mjs                       # últimos 7 dias de prod
 *   node scripts/analyze-prod-logins.mjs --since "2 days ago"
 *   node scripts/analyze-prod-logins.mjs --core-file core.log --nginx-file nginx.log
 *   node scripts/analyze-prod-logins.mjs --out -                # markdown no stdout
 *
 * Flags:
 *   --since <expr>     janela inicial do journalctl (default "7 days ago")
 *   --until <expr>     janela final do journalctl (default: agora)
 *   --host <user@host> default root@api.ifute.com.br (env SSH_HOST)
 *   --port <n>         default 51765 (env SSH_PORT)
 *   --core-file <p>    lê o log do core de um arquivo ("-" = stdin) em vez de SSH
 *   --nginx-file <p>   idem para o access log do nginx
 *   --no-nginx         não busca o log do nginx (sem coluna de plataforma)
 *   --window-min <n>   janela de atribuição login -> usuário, em min (default 15)
 *   --session-gap <n>  intervalo que separa duas sessões, em min (default 30)
 *   --top <n>          nº de rotas no ranking (default 15)
 *   --out <p>          caminho do markdown ("-" = stdout)
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Fuso de exibição. O Brasil não tem mais horário de verão, então -3 é fixo. */
const DISPLAY_TZ_OFFSET_HOURS = -3;
const DISPLAY_TZ_LABEL = "BRT";

/** Coordenadas fixas de teste em prod (meio do Atlântico Sul) — ver CLAUDE.md. */
const TEST_COORDS = { lat: -54.44, lon: -36.55 };

/** Distância máxima para rotular um cluster com o nome de uma cidade. */
const CITY_MATCH_RADIUS_KM = 60;

/**
 * Tabela offline de cidades para rotular clusters de lat/lon.
 *
 * ⚠️ Desde a task 32 a **fonte de verdade é o backend** (`labelCoordinate` em
 * `ifute-core-simple/src/shared/utils/helpers/cityLabel.ts`), consumida pela
 * tela de demanda do master-backoffice. A cópia aqui é deliberada: este script
 * lê log cru por SSH e precisa rodar sem API nem banco. Ao acrescentar cidade
 * em um dos dois, acrescente no outro.
 *
 * Deliberadamente offline: reverse geocoding exigiria rede e cota da
 * OpenWeatherMap, e o log já vem arredondado a ~1 km (LGPD), o que torna
 * qualquer precisão maior do que "qual cidade/região" inútil de todo modo.
 */
const CITIES = [
  ["São Paulo/SP", -23.55, -46.63],
  ["Guarulhos/SP", -23.45, -46.53],
  ["Campinas/SP", -22.91, -47.06],
  ["Santos/SP", -23.96, -46.33],
  ["São José dos Campos/SP", -23.18, -45.89],
  ["Ribeirão Preto/SP", -21.18, -47.81],
  ["Sorocaba/SP", -23.5, -47.46],
  ["Rio de Janeiro/RJ", -22.91, -43.17],
  ["Niterói/RJ", -22.88, -43.1],
  ["Campos dos Goytacazes/RJ", -21.75, -41.33],
  ["Belo Horizonte/MG", -19.92, -43.94],
  ["Uberlândia/MG", -18.91, -48.26],
  ["Juiz de Fora/MG", -21.76, -43.35],
  ["Vitória/ES", -20.32, -40.34],
  ["Curitiba/PR", -25.43, -49.27],
  ["Londrina/PR", -23.31, -51.16],
  ["Maringá/PR", -23.42, -51.94],
  ["Florianópolis/SC", -27.6, -48.55],
  ["Joinville/SC", -26.3, -48.85],
  ["Porto Alegre/RS", -30.03, -51.23],
  ["Caxias do Sul/RS", -29.17, -51.18],
  ["Brasília/DF", -15.79, -47.88],
  ["Goiânia/GO", -16.69, -49.26],
  ["Cuiabá/MT", -15.6, -56.1],
  ["Campo Grande/MS", -20.44, -54.65],
  ["Salvador/BA", -12.97, -38.51],
  ["Feira de Santana/BA", -12.27, -38.97],
  ["Recife/PE", -8.05, -34.88],
  ["Fortaleza/CE", -3.73, -38.53],
  ["Natal/RN", -5.79, -35.21],
  ["João Pessoa/PB", -7.12, -34.86],
  ["Maceió/AL", -9.65, -35.71],
  ["Aracaju/SE", -10.91, -37.07],
  ["Teresina/PI", -5.09, -42.8],
  ["São Luís/MA", -2.53, -44.3],
  ["Belém/PA", -1.46, -48.5],
  ["Manaus/AM", -3.12, -60.02],
  ["Porto Velho/RO", -8.76, -63.9],
  ["Rio Branco/AC", -9.98, -67.81],
  ["Boa Vista/RR", 2.82, -60.67],
  ["Macapá/AP", 0.03, -51.07],
  ["Palmas/TO", -10.18, -48.33],
];

// ─────────────────────────────────────────────────────────────── CLI ─────────

const parseArgs = (argv) => {
  const opts = {
    since: "7 days ago",
    until: null,
    host: process.env.SSH_HOST || "root@api.ifute.com.br",
    port: process.env.SSH_PORT || "51765",
    coreFile: null,
    nginxFile: null,
    nginx: true,
    windowMin: 15,
    sessionGapMin: 30,
    top: 15,
    out: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];

      if (value === undefined) fail(`Flag ${arg} exige um valor.`);

      i += 1;

      return value;
    };

    switch (arg) {
      case "--since": opts.since = next(); break;
      case "--until": opts.until = next(); break;
      case "--host": opts.host = next(); break;
      case "--port": opts.port = next(); break;
      case "--core-file": opts.coreFile = next(); break;
      case "--nginx-file": opts.nginxFile = next(); break;
      case "--no-nginx": opts.nginx = false; break;
      case "--window-min": opts.windowMin = Number(next()); break;
      case "--session-gap": opts.sessionGapMin = Number(next()); break;
      case "--top": opts.top = Number(next()); break;
      case "--out": opts.out = next(); break;
      case "-h":
      case "--help": printHelp(); process.exit(0); break;
      default: fail(`Flag desconhecida: ${arg}`);
    }
  }

  return opts;
};

const fail = (message) => {
  process.stderr.write(`❌ ${message}\n`);
  process.exit(1);
};

const printHelp = () => {
  const header = readFileSync(fileURLToPath(import.meta.url), "utf8")
    .split("\n")
    .slice(1)
    .filter((line) => line.startsWith(" *") || line.startsWith("/**"))
    .map((line) => line.replace(/^\s*\*\s?/, "").replace(/^\/\*\*$/, ""))
    .join("\n");

  process.stdout.write(`${header}\n`);
};

// ────────────────────────────────────────────────────── coleta dos logs ──────

const readSource = (file) =>
  file === "-" ? readFileSync(0, "utf8") : readFileSync(file, "utf8");

/**
 * Puxa um journal remoto por SSH.
 *
 * `-o cat` devolve só a mensagem do container (sem prefixo do syslog), que é
 * exatamente a linha JSON do pino / a linha do access log do nginx.
 */
const fetchJournal = (opts, tag) => {
  const remote = [
    "journalctl",
    `CONTAINER_TAG=${tag}`,
    "--since", quote(opts.since),
    ...(opts.until ? ["--until", quote(opts.until)] : []),
    "-o", "cat",
    "--no-pager",
  ].join(" ");

  const result = spawnSync(
    "ssh",
    ["-p", String(opts.port), opts.host, remote],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 512 }
  );

  if (result.error) fail(`Falha ao executar ssh: ${result.error.message}`);

  if (result.status !== 0) {
    fail(`journalctl (${tag}) falhou [exit ${result.status}]: ${(result.stderr || "").trim()}`);
  }

  return result.stdout || "";
};

const quote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;

// ─────────────────────────────────────────────────────────── parsing ─────────

/** Uma linha de acesso do core, já normalizada. */
const parseCoreLog = (text) => {
  const requests = [];
  let jsonLines = 0;
  let skipped = 0;

  for (const raw of text.split("\n")) {
    const line = raw.trim();

    if (!line.startsWith("{")) {
      if (line) skipped += 1;
      continue;
    }

    let entry;

    try {
      entry = JSON.parse(line);
    } catch {
      skipped += 1;
      continue;
    }

    jsonLines += 1;

    // "Request completed" é o log de acesso atual; "Incoming request" é o
    // formato antigo (só ip/path), que ainda aparece na cauda da retenção.
    const isCurrent = entry.msg === "Request completed";
    const isLegacy = entry.msg === "Incoming request";

    if (!isCurrent && !isLegacy) continue;

    const timestamp = Date.parse(entry.time);

    if (Number.isNaN(timestamp)) continue;

    requests.push({
      timestamp,
      requestId: typeof entry.request_id === "string" ? entry.request_id : null,
      ip: entry.ip || "sem-ip",
      path: entry.path || "/",
      method: entry.method || null,
      status: typeof entry.status === "number" ? entry.status : null,
      durationMs: typeof entry.duration_ms === "number" ? entry.duration_ms : null,
      aborted: entry.aborted === true,
      userId: typeof entry.user_id === "string" ? entry.user_id : null,
      lat: typeof entry.lat === "number" ? entry.lat : null,
      lon: typeof entry.lon === "number" ? entry.lon : null,
      tzOffset: typeof entry.tz_offset === "number" ? entry.tz_offset : null,
      legacy: isLegacy,
    });
  }

  requests.sort((a, b) => a.timestamp - b.timestamp);

  return { requests, jsonLines, skipped };
};

const NGINX_LINE =
  /^(\S+) - (\S+) \[([^\]]+)\] "([^"]*)" (\d{3}) (\d+) "([^"]*)" "([^"]*)" "([^"]*)" rt=(\S+) urt="([^"]*)" rid=(\S+)\s*$/;

/** Mapa request_id -> { userAgent, remoteAddr } vindo do access log do nginx. */
const parseNginxLog = (text) => {
  const byRequestId = new Map();

  for (const raw of text.split("\n")) {
    const match = NGINX_LINE.exec(raw.trim());

    if (!match) continue;

    byRequestId.set(match[12], { userAgent: match[8], remoteAddr: match[1] });
  }

  return byRequestId;
};

// ────────────────────────────────────────────────── classificação ────────────

const APP_PREFIXES = [
  ["/mobile", "mobile"],
  ["/backoffice", "backoffice"],
  ["/director", "director"],
  ["/webhook", "webhook"],
  ["/images", "images"],
];

const appOf = (path) => {
  for (const [prefix, name] of APP_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return name;
  }

  return "outros";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Subjects que não são pessoas.
 *
 * O `user_id` do log é o `sub` do JWT, e nem todo `sub` é usuário: o jobber
 * autentica no `/webhook/internal` com um `sub` fixo (constante
 * `DEFAULT_JOB_ACCESS_TOKEN_SUB_INTERNAL_WEBHOOK`). Como o cron bate a cada
 * minuto, ele domina qualquer contagem — se entrar como "usuário", afoga os
 * humanos no relatório. Não é segredo: é constante versionada no repo.
 */
const SERVICE_SUBJECTS = new Map([
  [
    "355e53040623c6e2f4c41a02d3ea2d64c343d866994fd356b4b2459c279da22d6839ee02a0464f6552b93024636d0b4e81c63ab7d7dded15a3d30c3659d0ed79",
    "ifute-jobber (crons internos)",
  ],
]);

/** Um `sub` que não é UUID não é usuário do banco — é automação. */
const isServiceSubject = (userId) =>
  SERVICE_SUBJECTS.has(userId) || !UUID.test(userId);

const serviceLabelOf = (userId) =>
  SERVICE_SUBJECTS.get(userId) || `automação não catalogada (\`${shortId(userId)}\`)`;

/** Colapsa ids em placeholders para que rotas iguais agrupem. */
const normalizePath = (path) =>
  path
    .split("/")
    .map((segment) => {
      if (UUID.test(segment)) return ":id";
      if (/^\d+$/.test(segment)) return ":n";

      // Arquivo servido por `/images` é `<uuid>.<ext>`: colapsa o id e mantém a
      // extensão, senão cada imagem vira uma "rota" própria no ranking.
      const file = /^(.+)\.([a-z0-9]{2,5})$/i.exec(segment);

      if (file && UUID.test(file[1])) return `:id.${file[2].toLowerCase()}`;
      if (segment.length > 24 && !segment.includes(".")) return ":token";

      return segment;
    })
    .join("/");

const LOGIN_PATH = /\/auth\/login\/(google|apple)$/;

const loginProviderOf = (path) => {
  const match = LOGIN_PATH.exec(path);

  return match ? match[1] : null;
};

/** Rótulo de plataforma a partir do User-Agent do nginx. */
const platformOf = (userAgent) => {
  if (!userAgent || userAgent === "-") return "desconhecida";

  const ios = /iFute\/(\d+)/.exec(userAgent);

  if (ios) return `app iOS (build ${ios[1]})`;
  if (/okhttp|Dalvik|Android/i.test(userAgent)) return "app Android";
  if (/Expo|ReactNative/i.test(userAgent)) return "app (Expo)";
  if (/Edg\//.test(userAgent)) return "navegador (Edge)";
  if (/Chrome\//.test(userAgent)) return "navegador (Chrome)";
  if (/Firefox\//.test(userAgent)) return "navegador (Firefox)";
  if (/Safari\//.test(userAgent)) return "navegador (Safari)";
  if (/curl|python|Go-http|axios|node-fetch/i.test(userAgent)) return "script/cliente HTTP";
  if (/bot|spider|crawl|scan/i.test(userAgent)) return "bot/scanner";

  return "outra";
};

// ─────────────────────────────────────────────────────────── geo ─────────────

const haversineKm = (aLat, aLon, bLat, bLon) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;

  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
};

const isTestCoord = (lat, lon) =>
  Math.abs(lat - TEST_COORDS.lat) < 0.05 && Math.abs(lon - TEST_COORDS.lon) < 0.05;

/** Rótulo humano de um par lat/lon já arredondado pelo log. */
const placeLabelOf = (lat, lon) => {
  if (isTestCoord(lat, lon)) return "coordenada de teste (Atlântico Sul)";

  let best = null;

  for (const [name, cityLat, cityLon] of CITIES) {
    const km = haversineKm(lat, lon, cityLat, cityLon);

    if (!best || km < best.km) best = { name, km };
  }

  if (best && best.km <= CITY_MATCH_RADIUS_KM) {
    return best.km < 12 ? best.name : `~${Math.round(best.km)} km de ${best.name}`;
  }

  // A tabela cobre só cidades brasileiras. Distinguir "interior do Brasil" de
  // "fora do Brasil" importa: a segunda categoria é quase sempre scanner.
  const inBrazil = lat >= -34 && lat <= 5.3 && lon >= -74 && lon <= -34.8;

  return inBrazil
    ? `interior/Brasil — sem cidade na tabela (mais próxima: ${best.name}, ~${Math.round(best.km)} km)`
    : "**fora do Brasil** — provável scanner/bot";
};

// ───────────────────────────────────────────────────────── análise ───────────

/**
 * Atribui cada login a um `user_id`.
 *
 * O login é rota pública (sem `user_id` na linha), então o vínculo é o primeiro
 * request autenticado do mesmo IP, no mesmo app, dentro da janela. Sem
 * candidato, o login fica sem atribuição — melhor um furo explícito do que um
 * palpite silencioso.
 */
const attributeLogins = (requests, windowMs) => {
  const authenticatedByIp = new Map();

  for (const request of requests) {
    if (!request.userId) continue;

    const key = `${request.ip}|${appOf(request.path)}`;

    if (!authenticatedByIp.has(key)) authenticatedByIp.set(key, []);

    authenticatedByIp.get(key).push(request);
  }

  const logins = [];

  for (const request of requests) {
    const provider = loginProviderOf(request.path);

    if (!provider) continue;
    if (request.method && request.method !== "POST") continue;

    const app = appOf(request.path);
    const succeeded = request.status === null ? null : request.status < 400;

    // Login que falhou não gerou sessão: atribuí-lo pegaria a sessão da
    // tentativa seguinte (bem-sucedida) e faria um 401 parecer um acesso.
    const candidates =
      succeeded === false ? [] : authenticatedByIp.get(`${request.ip}|${app}`) || [];
    const matched = candidates.find(
      (candidate) =>
        candidate.timestamp >= request.timestamp &&
        candidate.timestamp - request.timestamp <= windowMs
    );

    logins.push({
      ...request,
      app,
      provider,
      succeeded,
      userId: matched ? matched.userId : null,
      attributionLagMs: matched ? matched.timestamp - request.timestamp : null,
    });
  }

  return logins;
};

/** Agrupa os requests de cada usuário em sessões separadas por inatividade. */
const buildSessions = (requests, gapMs) => {
  const sessions = [];
  let current = null;

  for (const request of requests) {
    if (!current || request.timestamp - current.endedAt > gapMs) {
      current = {
        startedAt: request.timestamp,
        endedAt: request.timestamp,
        requests: [request],
      };
      sessions.push(current);
    } else {
      current.endedAt = request.timestamp;
      current.requests.push(request);
    }
  }

  return sessions;
};

const countBy = (items, keyOf) => {
  const counts = new Map();

  for (const item of items) {
    const key = keyOf(item);

    if (key === null || key === undefined) continue;

    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
};

const routeStats = (requests) => {
  const byRoute = new Map();

  for (const request of requests) {
    const key = `${request.method || "?"} ${normalizePath(request.path)}`;
    const stat = byRoute.get(key) || { route: key, count: 0, errors: 0, durations: [] };

    stat.count += 1;
    if (request.status !== null && request.status >= 400) stat.errors += 1;
    if (request.durationMs !== null) stat.durations.push(request.durationMs);

    byRoute.set(key, stat);
  }

  return [...byRoute.values()]
    .map((stat) => ({
      ...stat,
      p50: percentile(stat.durations, 50),
      p95: percentile(stat.durations, 95),
    }))
    .sort((a, b) => b.count - a.count || a.route.localeCompare(b.route));
};

const percentile = (values, p) => {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);

  return sorted[Math.max(0, index)];
};

const locationStats = (requests) => {
  const byCoord = new Map();

  for (const request of requests) {
    if (request.lat === null || request.lon === null) continue;

    const key = `${request.lat.toFixed(2)},${request.lon.toFixed(2)}`;
    const stat = byCoord.get(key) || {
      lat: request.lat,
      lon: request.lon,
      count: 0,
      users: new Set(),
      ips: new Set(),
    };

    stat.count += 1;
    if (request.userId) stat.users.add(request.userId);
    stat.ips.add(request.ip);

    byCoord.set(key, stat);
  }

  return [...byCoord.values()].sort((a, b) => b.count - a.count);
};

// ────────────────────────────────────────────────────── formatação ───────────

const fmtDateTime = (timestamp) => {
  const shifted = new Date(timestamp + DISPLAY_TZ_OFFSET_HOURS * 3600 * 1000);

  return `${shifted.toISOString().slice(0, 16).replace("T", " ")}`;
};

const fmtDate = (timestamp) =>
  new Date(timestamp + DISPLAY_TZ_OFFSET_HOURS * 3600 * 1000).toISOString().slice(0, 10);

const fmtDuration = (ms) => {
  if (ms === null || ms === undefined) return "—";

  const seconds = Math.round(ms / 1000);

  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);

  return `${minutes}min ${seconds % 60}s`;
};

const shortId = (id) => (id ? `${id.slice(0, 8)}…` : "—");

const table = (headers, rows) => {
  if (!rows.length) return "_(nada no período)_";

  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
};

// ─────────────────────────────────────────────────────── relatório ───────────

const buildReport = (opts, data) => {
  const { requests, logins, nginxByRequestId, jsonLines, skipped } = data;

  const windowMs = opts.windowMin * 60 * 1000;
  const gapMs = opts.sessionGapMin * 60 * 1000;

  const first = requests[0];
  const last = requests[requests.length - 1];

  const platformOfRequest = (request) => {
    const hit = request.requestId ? nginxByRequestId.get(request.requestId) : null;

    return hit ? platformOf(hit.userAgent) : "desconhecida";
  };

  const authenticated = requests.filter((request) => request.userId);
  const byUser = new Map();

  for (const request of authenticated) {
    if (!byUser.has(request.userId)) byUser.set(request.userId, []);

    byUser.get(request.userId).push(request);
  }

  // Ordena os usuários pelo mais recente primeiro — é o que se quer olhar.
  const subjects = [...byUser.entries()]
    .map(([userId, userRequests]) => ({
      userId,
      isService: isServiceSubject(userId),
      requests: userRequests,
      logins: logins.filter((login) => login.userId === userId),
      sessions: buildSessions(userRequests, gapMs),
      firstAt: userRequests[0].timestamp,
      lastAt: userRequests[userRequests.length - 1].timestamp,
    }))
    .sort((a, b) => b.lastAt - a.lastAt);

  const users = subjects.filter((subject) => !subject.isService);
  const services = subjects.filter((subject) => subject.isService);

  const lines = [];
  const push = (...text) => lines.push(...text, "");

  push(`# Relatório — Logins, rotas e localização em produção`);

  push(
    `**Gerado em:** ${fmtDateTime(Date.now())} ${DISPLAY_TZ_LABEL}`,
    `**Janela analisada:** \`--since ${opts.since}\`${opts.until ? ` \`--until ${opts.until}\`` : ""}` +
      (first ? ` → ${fmtDateTime(first.timestamp)} a ${fmtDateTime(last.timestamp)} ${DISPLAY_TZ_LABEL}` : ""),
    `**Fontes:** journald \`CONTAINER_TAG=ifute-core-simple\`` +
      (nginxByRequestId.size ? " + `CONTAINER_TAG=nginx` (User-Agent, ligado por `request_id`)" : " (sem nginx)"),
    `**Script:** [\`scripts/analyze-prod-logins.mjs\`](../../scripts/analyze-prod-logins.mjs) — gerado automaticamente, não editar à mão`
  );

  push(
    `> ⚠️ **Contém dados pessoais** (identificadores de conta, IP, localização aproximada). Uso interno; não publicar nem compartilhar externamente. As coordenadas vêm do log já arredondadas a ~1 km (\`roundCoordinateForLog\`), o que agrega demanda por região sem localizar ninguém.`
  );

  push("---", "## 1. Sumário");

  const statusBuckets = countBy(requests, (request) =>
    request.status === null ? "sem status (log legado)" : `${Math.floor(request.status / 100)}xx`
  );

  push(
    table(
      ["Métrica", "Valor"],
      [
        ["Requisições analisadas", String(requests.length)],
        ["Linhas JSON lidas / ignoradas", `${jsonLines} / ${skipped}`],
        ["Logins observados", String(logins.length)],
        [
          "Logins atribuídos a um usuário",
          `${logins.filter((login) => login.userId).length} de ${logins.length}`,
        ],
        ["Usuários distintos autenticados", String(users.length)],
        ["IPs distintos", String(new Set(requests.map((request) => request.ip)).size)],
        [
          "Requisições autenticadas",
          `${authenticated.length} (${pct(authenticated.length, requests.length)})`,
        ],
        [
          "— destas, de automação (jobber/cron)",
          `${services.reduce((sum, service) => sum + service.requests.length, 0)} ` +
            `(${pct(
              services.reduce((sum, service) => sum + service.requests.length, 0),
              requests.length
            )})`,
        ],
        [
          "— destas, de usuários reais",
          `${users.reduce((sum, user) => sum + user.requests.length, 0)} ` +
            `(${pct(
              users.reduce((sum, user) => sum + user.requests.length, 0),
              requests.length
            )})`,
        ],
        ["Requisições abortadas pelo cliente", String(requests.filter((request) => request.aborted).length)],
      ]
    )
  );

  push(
    "**Por app e por classe de status:**",
    table(
      ["Dimensão", "Valor", "Requisições"],
      [
        ...countBy(requests, (request) => appOf(request.path)).map(([app, count]) => [
          "app",
          app,
          `${count} (${pct(count, requests.length)})`,
        ]),
        ...statusBuckets.map(([bucket, count]) => [
          "status",
          bucket,
          `${count} (${pct(count, requests.length)})`,
        ]),
      ]
    )
  );

  push("---", "## 2. Logins");

  push(
    table(
      [`Data/hora (${DISPLAY_TZ_LABEL})`, "App", "Provider", "Status", "IP", "Usuário atribuído", "Plataforma"],
      logins.map((login) => [
        fmtDateTime(login.timestamp),
        login.app,
        login.provider,
        login.status === null ? "—" : `${login.status}${login.succeeded ? " ✅" : " ❌"}`,
        `\`${login.ip}\``,
        login.userId ? `\`${login.userId}\`` : "**não atribuído**",
        platformOfRequest(login),
      ])
    )
  );

  const unattributed = logins.filter((login) => !login.userId);

  if (unattributed.length) {
    push(
      `> ${unattributed.length} login(s) sem atribuição. Causas possíveis, em ordem de frequência: o login falhou (status ≥ 400, nenhuma requisição autenticada depois dele); o app não fez nenhuma chamada autenticada dentro dos ${opts.windowMin} min da janela; ou a sessão seguinte saiu por outro IP (troca de rede móvel). Aumentar \`--window-min\` costuma resolver o segundo caso.`
    );
  }

  push("---", "## 3. Usuários — rotas e localização");

  if (!users.length) {
    push(
      "_Nenhuma requisição de usuário real (com `sub` em formato UUID) no período._" +
        (services.length ? " Só automação — ver seção 3.1." : "")
    );
  }

  for (const user of users) {
    const userRoutes = routeStats(user.requests).slice(0, 8);
    const userLocations = locationStats(user.requests);
    const platforms = countBy(user.requests, platformOfRequest).filter(
      ([label]) => label !== "desconhecida"
    );
    const errors = user.requests.filter(
      (request) => request.status !== null && request.status >= 400
    );

    push(`### \`${user.userId}\``);

    push(
      table(
        ["Campo", "Valor"],
        [
          ["Primeiro acesso no período", `${fmtDateTime(user.firstAt)} ${DISPLAY_TZ_LABEL}`],
          ["Último acesso no período", `${fmtDateTime(user.lastAt)} ${DISPLAY_TZ_LABEL}`],
          ["Requisições autenticadas", String(user.requests.length)],
          ["Sessões", `${user.sessions.length} (corte de inatividade: ${opts.sessionGapMin} min)`],
          ["Logins no período", user.logins.length ? String(user.logins.length) : "0 (sessão já autenticada)"],
          ["IPs", countBy(user.requests, (request) => request.ip).map(([ip, count]) => `\`${ip}\` (${count})`).join(", ")],
          ["Plataforma", platforms.length ? platforms.map(([label, count]) => `${label} (${count})`).join(", ") : "desconhecida"],
          ["Respostas ≥ 400", errors.length ? `${errors.length} (${pct(errors.length, user.requests.length)})` : "0"],
        ]
      )
    );

    push(
      "**Rotas mais acessadas:**",
      table(
        ["Rota", "Requisições", "Erros", "p50", "p95"],
        userRoutes.map((stat) => [
          `\`${stat.route}\``,
          String(stat.count),
          stat.errors ? String(stat.errors) : "—",
          stat.p50 === null ? "—" : `${stat.p50} ms`,
          stat.p95 === null ? "—" : `${stat.p95} ms`,
        ])
      )
    );

    if (userLocations.length) {
      push(
        "**Localização (headers `lat`/`lon`, ~1 km):**",
        table(
          ["Coordenada", "Onde é", "Requisições"],
          userLocations
            .slice(0, 5)
            .map((location) => [
              `\`${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}\``,
              placeLabelOf(location.lat, location.lon),
              String(location.count),
            ])
        )
      );
    } else {
      push(
        "**Localização:** nenhuma requisição com `lat`/`lon` — só as rotas de busca (`/place/discover`, `/place/city`) enviam esses headers."
      );
    }

    push(
      "**Sessões:**",
      table(
        [`Início (${DISPLAY_TZ_LABEL})`, "Duração", "Requisições", "Primeira rota", "Última rota"],
        user.sessions.map((session) => [
          fmtDateTime(session.startedAt),
          fmtDuration(session.endedAt - session.startedAt),
          String(session.requests.length),
          `\`${normalizePath(session.requests[0].path)}\``,
          `\`${normalizePath(session.requests[session.requests.length - 1].path)}\``,
        ])
      )
    );
  }

  if (services.length) {
    push("### 3.1. Identidades de serviço (não são pessoas)");

    push(
      table(
        ["Identidade", "Requisições", "Rotas", "Primeira", "Última"],
        services.map((service) => [
          serviceLabelOf(service.userId),
          String(service.requests.length),
          routeStats(service.requests)
            .slice(0, 3)
            .map((stat) => `\`${stat.route}\` (${stat.count})`)
            .join("<br>"),
          fmtDateTime(service.firstAt),
          fmtDateTime(service.lastAt),
        ])
      )
    );

    push(
      "> Estas linhas têm `user_id` porque o `sub` do JWT é logado sem distinguir pessoa de automação. Ficam fora das contagens de usuário para não distorcer o relatório."
    );
  }

  push("---", `## 4. Rotas mais acessadas (todas as requisições)`);

  push(
    table(
      ["Rota", "App", "Requisições", "Erros", "p50", "p95"],
      routeStats(requests)
        .slice(0, opts.top)
        .map((stat) => [
          `\`${stat.route}\``,
          appOf(stat.route.split(" ")[1] || "/"),
          String(stat.count),
          stat.errors ? `${stat.errors} (${pct(stat.errors, stat.count)})` : "—",
          stat.p50 === null ? "—" : `${stat.p50} ms`,
          stat.p95 === null ? "—" : `${stat.p95} ms`,
        ])
    )
  );

  push("---", "## 5. Localizações agregadas");

  const allLocations = locationStats(requests);

  if (allLocations.length) {
    push(
      table(
        ["Coordenada (~1 km)", "Onde é", "Requisições", "Usuários", "IPs", "Mapa"],
        allLocations
          .slice(0, opts.top)
          .map((location) => [
            `\`${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}\``,
            placeLabelOf(location.lat, location.lon),
            String(location.count),
            String(location.users.size),
            String(location.ips.size),
            `[abrir](https://www.google.com/maps?q=${location.lat},${location.lon})`,
          ])
      )
    );

    const testHits = allLocations.filter((location) => isTestCoord(location.lat, location.lon));

    if (testHits.length) {
      push(
        `> Coordenadas de teste (Atlântico Sul) aparecem em ${testHits.reduce((sum, hit) => sum + hit.count, 0)} requisição(ões) — tráfego interno de validação, não usuário real (ver CLAUDE.md, "Testes em Produção").`
      );
    }
  } else {
    push("_Nenhuma requisição com `lat`/`lon` no período._");
  }

  push("---", "## 6. Erros (status ≥ 400)");

  const errorRoutes = routeStats(
    requests.filter((request) => request.status !== null && request.status >= 400)
  ).slice(0, opts.top);

  push(
    table(
      ["Rota", "Ocorrências"],
      errorRoutes.map((stat) => [`\`${stat.route}\``, String(stat.count)])
    )
  );

  push("---", "## 7. Como ler (e o que este relatório não diz)");

  push(
    `- **Atribuição de login é inferida, não logada.** O login é rota pública e roda antes do \`authenticateToken\`, então a linha não tem \`user_id\`. O vínculo aqui é *mesmo IP + mesmo app + primeira requisição autenticada em até ${opts.windowMin} min*. Confiável no volume atual; com muitos usuários por trás do mesmo NAT, deixa de ser.`,
    `- **Sem e-mail nem nome.** O log carrega \`user_id\` (UUID), por escolha de privacidade. Para resolver identidade, consultar o banco: \`SELECT id, name, email, created_at FROM "user" WHERE id = '<uuid>';\` (túnel em \`ifute-compose/README.md\`).`,
    `- **Localização só existe onde o app envia os headers.** Hoje \`GET /mobile/public/place/discover\` e \`/place/city\`. Usuário que não abriu a busca não tem coordenada — ausência aqui não é ausência de uso.`,
    `- **Rotas públicas não têm usuário.** \`${pct(requests.length - authenticated.length, requests.length)}\` das requisições são anônimas (públicas, webhooks, imagens, scanners); elas contam nos rankings globais mas não na seção por usuário.`,
    `- **\`user_id\` é o \`sub\` do JWT, não necessariamente uma pessoa.** Subjects que não são UUID (jobber/cron) saem na seção 3.1 e não contam como usuário.`,
    `- **A janela real pode ser menor que o \`--since\`.** A retenção do journald é de ~28 dias / 250 MB, mas **prospectiva**: não há histórico anterior a quando \`Storage=persistent\` foi habilitado no servidor. Confira sempre a linha "Janela analisada" no topo — é o intervalo que de fato existe, e um \`--since\` maior traz menos dados sem erro.`
  );

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
};

const pct = (part, total) => (total ? `${((part / total) * 100).toFixed(1)}%` : "0%");

// ──────────────────────────────────────────────────────────── main ───────────

const main = () => {
  const opts = parseArgs(process.argv.slice(2));

  const coreText = opts.coreFile
    ? readSource(opts.coreFile)
    : fetchJournal(opts, "ifute-core-simple");

  const { requests, jsonLines, skipped } = parseCoreLog(coreText);

  if (!requests.length) {
    fail(
      "Nenhuma linha de acesso encontrada. Confira a janela (--since) e se o container ainda se chama `ifute-core-simple`."
    );
  }

  let nginxText = "";

  if (opts.nginxFile) {
    nginxText = readSource(opts.nginxFile);
  } else if (opts.nginx && !opts.coreFile) {
    nginxText = fetchJournal(opts, "nginx");
  }

  const data = {
    requests,
    logins: attributeLogins(requests, opts.windowMin * 60 * 1000),
    nginxByRequestId: parseNginxLog(nginxText),
    jsonLines,
    skipped,
  };

  const markdown = buildReport(opts, data);

  if (opts.out === "-") {
    process.stdout.write(markdown);

    return;
  }

  const outPath = opts.out
    ? resolve(process.cwd(), opts.out)
    : resolve(REPO_ROOT, "reports", "historico", `${fmtDate(Date.now())}-logins-rotas-prod.md`);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, markdown);

  process.stderr.write(
    `✅ ${requests.length} requisições, ${data.logins.length} login(s), ` +
      `${new Set(requests.filter((request) => request.userId).map((request) => request.userId)).size} usuário(s)\n` +
      `📄 ${outPath}\n`
  );
};

main();

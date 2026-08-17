# Relatório — Logins, rotas e localização em produção

**Gerado em:** 2026-08-14 10:54 BRT
**Janela analisada:** `--since 4 days ago` → 2026-08-10 10:54 a 2026-08-14 10:53 BRT
**Fontes:** journald `CONTAINER_TAG=ifute-core-simple` + `CONTAINER_TAG=nginx` (User-Agent, ligado por `request_id`)
**Script:** [`scripts/analyze-prod-logins.mjs`](../../scripts/analyze-prod-logins.mjs) — gerado automaticamente, não editar à mão

> ⚠️ **Contém dados pessoais** (identificadores de conta, IP, localização aproximada). Uso interno; não publicar nem compartilhar externamente. As coordenadas vêm do log já arredondadas a ~1 km (`roundCoordinateForLog`), o que agrega demanda por região sem localizar ninguém.

---
## 1. Sumário

| Métrica | Valor |
|---|---|
| Requisições analisadas | 24277 |
| Linhas JSON lidas / ignoradas | 87731 / 253 |
| Logins observados | 6 |
| Logins atribuídos a um usuário | 6 de 6 |
| Usuários distintos autenticados | 3 |
| IPs distintos | 12 |
| Requisições autenticadas | 23415 (96.4%) |
| — destas, de automação (jobber/cron) | 23040 (94.9%) |
| — destas, de usuários reais | 375 (1.5%) |
| Requisições abortadas pelo cliente | 0 |

**Por app e por classe de status:**
| Dimensão | Valor | Requisições |
|---|---|---|
| app | webhook | 23044 (94.9%) |
| app | director | 582 (2.4%) |
| app | images | 441 (1.8%) |
| app | backoffice | 125 (0.5%) |
| app | mobile | 72 (0.3%) |
| app | outros | 13 (0.1%) |
| status | 2xx | 23478 (96.7%) |
| status | 3xx | 762 (3.1%) |
| status | 4xx | 37 (0.2%) |

---
## 2. Logins

| Data/hora (BRT) | App | Provider | Status | IP | Usuário atribuído | Plataforma |
|---|---|---|---|---|---|---|
| 2026-08-11 10:40 | director | google | 200 ✅ | `189.7.228.9` | `dc90137f-2882-4be8-b4de-cb555990a207` | navegador (Chrome) |
| 2026-08-12 14:18 | director | google | 200 ✅ | `189.7.228.9` | `dc90137f-2882-4be8-b4de-cb555990a207` | navegador (Chrome) |
| 2026-08-12 20:27 | mobile | google | 200 ✅ | `189.7.228.9` | `5d86a46d-b8b4-4e20-9c54-26be0f3eefe6` | app iOS (build 37) |
| 2026-08-12 20:31 | backoffice | google | 200 ✅ | `189.7.228.9` | `dc90137f-2882-4be8-b4de-cb555990a207` | navegador (Chrome) |
| 2026-08-12 20:32 | backoffice | google | 200 ✅ | `189.7.228.9` | `a8d38f0b-dbad-4d96-bc1e-04eeabfb1f87` | navegador (Chrome) |
| 2026-08-13 14:19 | director | google | 200 ✅ | `189.7.228.9` | `dc90137f-2882-4be8-b4de-cb555990a207` | navegador (Chrome) |

---
## 3. Usuários — rotas e localização

### `dc90137f-2882-4be8-b4de-cb555990a207`

| Campo | Valor |
|---|---|
| Primeiro acesso no período | 2026-08-10 10:54 BRT |
| Último acesso no período | 2026-08-14 09:12 BRT |
| Requisições autenticadas | 280 |
| Sessões | 21 (corte de inatividade: 30 min) |
| Logins no período | 4 |
| IPs | `189.7.228.9` (280) |
| Plataforma | navegador (Chrome) (280) |
| Respostas ≥ 400 | 0 |

**Rotas mais acessadas:**
| Rota | Requisições | Erros | p50 | p95 |
|---|---|---|---|---|
| `GET /director/private/recents/admins` | 78 | — | 16 ms | 27 ms |
| `GET /director/private/recents/places` | 78 | — | 18 ms | 29 ms |
| `GET /director/private/recents/users` | 78 | — | 10 ms | 25 ms |
| `GET /director/private/reports/places/ranking` | 11 | — | 9 ms | 11 ms |
| `GET /director/private/reports/revenue/monthly` | 11 | — | 9 ms | 13 ms |
| `GET /director/private/config/platform-pix-key` | 8 | — | 5 ms | 15 ms |
| `GET /director/private/withdrawal/history` | 8 | — | 7 ms | 19 ms |
| `GET /director/private/withdrawal/balance` | 7 | — | 15 ms | 28 ms |

**Localização:** nenhuma requisição com `lat`/`lon` — só as rotas de busca (`/place/discover`, `/place/city`) enviam esses headers.

**Sessões:**
| Início (BRT) | Duração | Requisições | Primeira rota | Última rota |
|---|---|---|---|---|
| 2026-08-10 10:54 | 37min 28s | 15 | `/director/private/recents/admins` | `/director/private/recents/admins` |
| 2026-08-10 14:25 | 42s | 6 | `/director/private/recents/admins` | `/director/private/recents/places` |
| 2026-08-10 15:44 | 3min 57s | 11 | `/director/private/withdrawal/balance` | `/director/private/recents/places` |
| 2026-08-10 17:43 | 0s | 3 | `/director/private/recents/users` | `/director/private/recents/places` |
| 2026-08-10 23:46 | 27min 19s | 17 | `/director/private/recents/users` | `/director/private/recents/places` |
| 2026-08-11 09:25 | 25s | 11 | `/director/private/recents/places` | `/director/private/recents/places` |
| 2026-08-11 10:40 | 1min 50s | 8 | `/director/private/reports/places/ranking` | `/director/private/recents/places` |
| 2026-08-11 12:43 | 0s | 3 | `/director/private/recents/admins` | `/director/private/recents/places` |
| 2026-08-11 23:26 | 2min 22s | 6 | `/director/private/recents/users` | `/director/private/recents/places` |
| 2026-08-12 02:49 | 0s | 3 | `/director/private/recents/admins` | `/director/private/recents/places` |
| 2026-08-12 14:18 | 63min 21s | 31 | `/director/private/reports/places/ranking` | `/director/private/recents/places` |
| 2026-08-12 15:54 | 41min 56s | 12 | `/director/private/recents/admins` | `/director/private/recents/places` |
| 2026-08-12 17:14 | 55min 13s | 33 | `/director/private/recents/users` | `/director/private/recents/places` |
| 2026-08-12 20:15 | 36min 4s | 21 | `/director/private/withdrawal/balance` | `/director/private/recents/admins` |
| 2026-08-13 09:01 | 13min 25s | 12 | `/director/private/recents/admins` | `/director/private/recents/places` |
| 2026-08-13 11:18 | 6min 14s | 9 | `/director/private/recents/admins` | `/director/private/recents/places` |
| 2026-08-13 13:44 | 35min 48s | 22 | `/director/private/recents/users` | `/director/private/recents/places` |
| 2026-08-13 15:47 | 23min 50s | 22 | `/director/private/reports/places/ranking` | `/director/private/recents/places` |
| 2026-08-13 17:07 | 49min 44s | 18 | `/director/private/recents/admins` | `/director/private/recents/places` |
| 2026-08-13 21:23 | 0s | 3 | `/director/private/recents/users` | `/director/private/recents/places` |
| 2026-08-14 09:08 | 4min 17s | 14 | `/director/private/recents/admins` | `/director/private/recents/places` |

### `a8d38f0b-dbad-4d96-bc1e-04eeabfb1f87`

| Campo | Valor |
|---|---|
| Primeiro acesso no período | 2026-08-12 20:32 BRT |
| Último acesso no período | 2026-08-13 15:50 BRT |
| Requisições autenticadas | 58 |
| Sessões | 2 (corte de inatividade: 30 min) |
| Logins no período | 1 |
| IPs | `189.7.228.9` (58) |
| Plataforma | navegador (Chrome) (58) |
| Respostas ≥ 400 | 0 |

**Rotas mais acessadas:**
| Rota | Requisições | Erros | p50 | p95 |
|---|---|---|---|---|
| `GET /backoffice/private/withdrawal/balance` | 8 | — | 12 ms | 37 ms |
| `GET /backoffice/private/withdrawal/history` | 8 | — | 7 ms | 21 ms |
| `GET /backoffice/private/adminPlaces` | 5 | — | 7 ms | 18 ms |
| `GET /backoffice/private/adminUser` | 5 | — | 8 ms | 21 ms |
| `GET /backoffice/private/adminUser/finances/records` | 5 | — | 17 ms | 31 ms |
| `GET /backoffice/private/adminUser/finances/summary` | 5 | — | 14 ms | 36 ms |
| `GET /backoffice/private/adminUser/userRole` | 3 | — | 7 ms | 17 ms |
| `GET /backoffice/private/affiliate/affiliates` | 3 | — | 7 ms | 7 ms |

**Localização:** nenhuma requisição com `lat`/`lon` — só as rotas de busca (`/place/discover`, `/place/city`) enviam esses headers.

**Sessões:**
| Início (BRT) | Duração | Requisições | Primeira rota | Última rota |
|---|---|---|---|---|
| 2026-08-12 20:32 | 6min 32s | 45 | `/backoffice/private/adminPlaces` | `/backoffice/private/affiliate/commissions` |
| 2026-08-13 15:50 | 2s | 13 | `/backoffice/private/withdrawal/balance` | `/backoffice/private/affiliate/commissions` |

### `5d86a46d-b8b4-4e20-9c54-26be0f3eefe6`

| Campo | Valor |
|---|---|
| Primeiro acesso no período | 2026-08-12 20:27 BRT |
| Último acesso no período | 2026-08-12 20:37 BRT |
| Requisições autenticadas | 37 |
| Sessões | 1 (corte de inatividade: 30 min) |
| Logins no período | 1 |
| IPs | `189.7.228.9` (37) |
| Plataforma | app iOS (build 37) (37) |
| Respostas ≥ 400 | 0 |

**Rotas mais acessadas:**
| Rota | Requisições | Erros | p50 | p95 |
|---|---|---|---|---|
| `GET /mobile/private/payment/order/status` | 11 | — | 7 ms | 9 ms |
| `GET /mobile/private/place/appointmentOrders` | 4 | — | 11 ms | 24 ms |
| `GET /mobile/private/place/appointment` | 3 | — | 12 ms | 29 ms |
| `GET /mobile/private/user` | 3 | — | 6 ms | 17 ms |
| `GET /mobile/private/user/recent` | 3 | — | 24 ms | 28 ms |
| `GET /mobile/private/payment/order/:id` | 2 | — | 8 ms | 23 ms |
| `POST /mobile/private/user/favorite` | 2 | — | 17 ms | 20 ms |
| `POST /mobile/private/user/fcmtoken` | 2 | — | 10 ms | 15 ms |

**Localização (headers `lat`/`lon`, ~1 km):**
| Coordenada | Onde é | Requisições |
|---|---|---|
| `-54.44, -36.55` | coordenada de teste (Atlântico Sul) | 37 |

**Sessões:**
| Início (BRT) | Duração | Requisições | Primeira rota | Última rota |
|---|---|---|---|---|
| 2026-08-12 20:27 | 10min 26s | 37 | `/mobile/private/user/recent` | `/mobile/private/place/appointmentOrders` |

### 3.1. Identidades de serviço (não são pessoas)

| Identidade | Requisições | Rotas | Primeira | Última |
|---|---|---|---|---|
| ifute-jobber (crons internos) | 23040 | `POST /webhook/internal/stripe` (23040) | 2026-08-10 10:54 | 2026-08-14 10:53 |

> Estas linhas têm `user_id` porque o `sub` do JWT é logado sem distinguir pessoa de automação. Ficam fora das contagens de usuário para não distorcer o relatório.

---
## 4. Rotas mais acessadas (todas as requisições)

| Rota | App | Requisições | Erros | p50 | p95 |
|---|---|---|---|---|---|
| `POST /webhook/internal/stripe` | webhook | 23040 | — | 21 ms | 45 ms |
| `GET /images/public/:id.png` | images | 249 | — | 1 ms | 4 ms |
| `GET /images/public/:id.jpg` | images | 192 | — | 1 ms | 3 ms |
| `GET /director/private/recents/admins` | director | 80 | 2 (2.5%) | 15 ms | 25 ms |
| `GET /director/private/recents/places` | director | 80 | 2 (2.5%) | 18 ms | 29 ms |
| `GET /director/private/recents/users` | director | 80 | 2 (2.5%) | 10 ms | 25 ms |
| `OPTIONS /director/private/recents/admins` | director | 79 | — | 1 ms | 2 ms |
| `OPTIONS /director/private/recents/places` | director | 79 | — | 1 ms | 3 ms |
| `OPTIONS /director/private/recents/users` | director | 79 | — | 1 ms | 2 ms |
| `GET /director/private/reports/places/ranking` | director | 11 | — | 9 ms | 11 ms |
| `GET /director/private/reports/revenue/monthly` | director | 11 | — | 9 ms | 13 ms |
| `GET /mobile/private/payment/order/status` | mobile | 11 | — | 7 ms | 9 ms |
| `OPTIONS /director/private/reports/places/ranking` | director | 11 | — | 1 ms | 1 ms |
| `OPTIONS /director/private/reports/revenue/monthly` | director | 11 | — | 1 ms | 1 ms |
| `GET /mobile/public/businessConfig` | mobile | 10 | — | 17 ms | 24 ms |

---
## 5. Localizações agregadas

| Coordenada (~1 km) | Onde é | Requisições | Usuários | IPs | Mapa |
|---|---|---|---|---|---|
| `-54.44, -36.55` | coordenada de teste (Atlântico Sul) | 61 | 1 | 1 | [abrir](https://www.google.com/maps?q=-54.44,-36.55) |
| `-8.06, -34.87` | Recife/PE | 3 | 0 | 1 | [abrir](https://www.google.com/maps?q=-8.06,-34.87) |
| `-16.38, -44.44` | interior/Brasil — sem cidade na tabela (mais próxima: Brasília/DF, ~373 km) | 3 | 0 | 1 | [abrir](https://www.google.com/maps?q=-16.38,-44.44) |

> Coordenadas de teste (Atlântico Sul) aparecem em 61 requisição(ões) — tráfego interno de validação, não usuário real (ver CLAUDE.md, "Testes em Produção").

---
## 6. Erros (status ≥ 400)

| Rota | Ocorrências |
|---|---|
| `GET /` | 5 |
| `GET /mobile/private/auth/login/check` | 5 |
| `GET /robots.txt` | 4 |
| `GET /director/private/auth/login/check` | 3 |
| `GET /backoffice/private/auth/login/check` | 2 |
| `GET /director/private/recents/admins` | 2 |
| `GET /director/private/recents/places` | 2 |
| `GET /director/private/recents/users` | 2 |
| `GET /favicon.ico` | 2 |
| `GET /mobile/private/user` | 2 |
| `GET /mobile/public/place/discover` | 2 |
| `HEAD /` | 2 |
| `GET /director/private/config/platform-pix-key` | 1 |
| `GET /director/private/withdrawal/balance` | 1 |
| `GET /director/private/withdrawal/history` | 1 |

---
## 7. Como ler (e o que este relatório não diz)

- **Atribuição de login é inferida, não logada.** O login é rota pública e roda antes do `authenticateToken`, então a linha não tem `user_id`. O vínculo aqui é *mesmo IP + mesmo app + primeira requisição autenticada em até 15 min*. Confiável no volume atual; com muitos usuários por trás do mesmo NAT, deixa de ser.
- **Sem e-mail nem nome.** O log carrega `user_id` (UUID), por escolha de privacidade. Para resolver identidade, consultar o banco: `SELECT id, name, email, created_at FROM "user" WHERE id = '<uuid>';` (túnel em `ifute-compose/README.md`).
- **Localização só existe onde o app envia os headers.** Hoje `GET /mobile/public/place/discover` e `/place/city`. Usuário que não abriu a busca não tem coordenada — ausência aqui não é ausência de uso.
- **Rotas públicas não têm usuário.** `3.6%` das requisições são anônimas (públicas, webhooks, imagens, scanners); elas contam nos rankings globais mas não na seção por usuário.
- **`user_id` é o `sub` do JWT, não necessariamente uma pessoa.** Subjects que não são UUID (jobber/cron) saem na seção 3.1 e não contam como usuário.
- **A janela real pode ser menor que o `--since`.** A retenção do journald é de ~28 dias / 250 MB, mas **prospectiva**: não há histórico anterior a quando `Storage=persistent` foi habilitado no servidor. Confira sempre a linha "Janela analisada" no topo — é o intervalo que de fato existe, e um `--since` maior traz menos dados sem erro.

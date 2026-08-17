# Relatório — Logins, rotas e localização em produção

**Gerado em:** 2026-08-10 23:48 BRT
**Janela analisada:** `--since 2 days ago` → 2026-08-10 00:05 a 2026-08-10 23:48 BRT
**Fontes:** journald `CONTAINER_TAG=ifute-core-simple` + `CONTAINER_TAG=nginx` (User-Agent, ligado por `request_id`)
**Script:** [`scripts/analyze-prod-logins.mjs`](../../scripts/analyze-prod-logins.mjs) — gerado automaticamente, não editar à mão

> ⚠️ **Contém dados pessoais** (identificadores de conta, IP, localização aproximada). Uso interno; não publicar nem compartilhar externamente. As coordenadas vêm do log já arredondadas a ~1 km (`roundCoordinateForLog`), o que agrega demanda por região sem localizar ninguém.

---
## 1. Sumário

| Métrica | Valor |
|---|---|
| Requisições analisadas | 5880 |
| Linhas JSON lidas / ignoradas | 21570 / 55 |
| Logins observados | 1 |
| Logins atribuídos a um usuário | 1 de 1 |
| Usuários distintos autenticados | 2 |
| IPs distintos | 6 |
| Requisições autenticadas | 5746 (97.7%) |
| — destas, de automação (jobber/cron) | 5692 (96.8%) |
| — destas, de usuários reais | 54 (0.9%) |
| Requisições abortadas pelo cliente | 0 |

**Por app e por classe de status:**
| Dimensão | Valor | Requisições |
|---|---|---|
| app | webhook | 5692 (96.8%) |
| app | director | 102 (1.7%) |
| app | images | 64 (1.1%) |
| app | mobile | 18 (0.3%) |
| app | outros | 4 (0.1%) |
| status | 2xx | 5751 (97.8%) |
| status | 3xx | 120 (2.0%) |
| status | 4xx | 9 (0.2%) |

---
## 2. Logins

| Data/hora (BRT) | App | Provider | Status | IP | Usuário atribuído | Plataforma |
|---|---|---|---|---|---|---|
| 2026-08-10 10:35 | director | google | 200 ✅ | `189.7.228.9` | `dc90137f-2882-4be8-b4de-cb555990a207` | navegador (Chrome) |

---
## 3. Usuários — rotas e localização

### `dc90137f-2882-4be8-b4de-cb555990a207`

| Campo | Valor |
|---|---|
| Primeiro acesso no período | 2026-08-10 10:35 BRT |
| Último acesso no período | 2026-08-10 23:46 BRT |
| Requisições autenticadas | 49 |
| Sessões | 5 (corte de inatividade: 30 min) |
| Logins no período | 1 |
| IPs | `189.7.228.9` (49) |
| Plataforma | navegador (Chrome) (49) |
| Respostas ≥ 400 | 0 |

**Rotas mais acessadas:**
| Rota | Requisições | Erros | p50 | p95 |
|---|---|---|---|---|
| `GET /director/private/recents/admins` | 14 | — | 23 ms | 33 ms |
| `GET /director/private/recents/places` | 14 | — | 23 ms | 32 ms |
| `GET /director/private/recents/users` | 14 | — | 11 ms | 30 ms |
| `GET /director/private/reports/places/ranking` | 2 | — | 9 ms | 10 ms |
| `GET /director/private/reports/revenue/monthly` | 2 | — | 8 ms | 9 ms |
| `GET /director/private/config/platform-pix-key` | 1 | — | 5 ms | 5 ms |
| `GET /director/private/withdrawal/balance` | 1 | — | 15 ms | 15 ms |
| `GET /director/private/withdrawal/history` | 1 | — | 8 ms | 8 ms |

**Localização:** nenhuma requisição com `lat`/`lon` — só as rotas de busca (`/place/discover`, `/place/city`) enviam esses headers.

**Sessões:**
| Início (BRT) | Duração | Requisições | Primeira rota | Última rota |
|---|---|---|---|---|
| 2026-08-10 10:35 | 56min 20s | 26 | `/director/private/reports/revenue/monthly` | `/director/private/recents/admins` |
| 2026-08-10 14:25 | 42s | 6 | `/director/private/recents/admins` | `/director/private/recents/places` |
| 2026-08-10 15:44 | 3min 57s | 11 | `/director/private/withdrawal/balance` | `/director/private/recents/places` |
| 2026-08-10 17:43 | 0s | 3 | `/director/private/recents/users` | `/director/private/recents/places` |
| 2026-08-10 23:46 | 0s | 3 | `/director/private/recents/users` | `/director/private/recents/admins` |

### `5d86a46d-b8b4-4e20-9c54-26be0f3eefe6`

| Campo | Valor |
|---|---|
| Primeiro acesso no período | 2026-08-10 00:05 BRT |
| Último acesso no período | 2026-08-10 00:05 BRT |
| Requisições autenticadas | 5 |
| Sessões | 1 (corte de inatividade: 30 min) |
| Logins no período | 0 (sessão já autenticada) |
| IPs | `189.7.228.9` (5) |
| Plataforma | app iOS (build 37) (5) |
| Respostas ≥ 400 | 0 |

**Rotas mais acessadas:**
| Rota | Requisições | Erros | p50 | p95 |
|---|---|---|---|---|
| `GET /mobile/private/auth/login/check` | 1 | — | 12 ms | 12 ms |
| `GET /mobile/private/place` | 1 | — | 103 ms | 103 ms |
| `GET /mobile/private/user/favorites` | 1 | — | 18 ms | 18 ms |
| `GET /mobile/private/user/recent` | 1 | — | 15 ms | 15 ms |
| `POST /mobile/private/user/fcmtoken` | 1 | — | 27 ms | 27 ms |

**Localização (headers `lat`/`lon`, ~1 km):**
| Coordenada | Onde é | Requisições |
|---|---|---|
| `-54.44, -36.55` | coordenada de teste (Atlântico Sul) | 5 |

**Sessões:**
| Início (BRT) | Duração | Requisições | Primeira rota | Última rota |
|---|---|---|---|---|
| 2026-08-10 00:05 | 6s | 5 | `/mobile/private/auth/login/check` | `/mobile/private/place` |

### 3.1. Identidades de serviço (não são pessoas)

| Identidade | Requisições | Rotas | Primeira | Última |
|---|---|---|---|---|
| ifute-jobber (crons internos) | 5692 | `POST /webhook/internal/stripe` (5692) | 2026-08-10 00:06 | 2026-08-10 23:48 |

> Estas linhas têm `user_id` porque o `sub` do JWT é logado sem distinguir pessoa de automação. Ficam fora das contagens de usuário para não distorcer o relatório.

---
## 4. Rotas mais acessadas (todas as requisições)

| Rota | App | Requisições | Erros | p50 | p95 |
|---|---|---|---|---|---|
| `POST /webhook/internal/stripe` | webhook | 5692 | — | 21 ms | 49 ms |
| `GET /images/public/:id.png` | images | 46 | — | 1 ms | 4 ms |
| `GET /images/public/:id.jpg` | images | 18 | — | 1 ms | 6 ms |
| `GET /director/private/recents/admins` | director | 14 | — | 23 ms | 33 ms |
| `GET /director/private/recents/places` | director | 14 | — | 23 ms | 32 ms |
| `GET /director/private/recents/users` | director | 14 | — | 11 ms | 30 ms |
| `OPTIONS /director/private/recents/admins` | director | 14 | — | 1 ms | 3 ms |
| `OPTIONS /director/private/recents/places` | director | 14 | — | 1 ms | 2 ms |
| `OPTIONS /director/private/recents/users` | director | 14 | — | 1 ms | 2 ms |
| `GET /mobile/public/businessConfig` | mobile | 5 | — | 6 ms | 31 ms |
| `GET /mobile/public/place/discover` | mobile | 5 | 2 (40.0%) | 15 ms | 48 ms |
| `GET /` | outros | 2 | 2 (100.0%) | 4 ms | 5 ms |
| `GET /director/private/reports/places/ranking` | director | 2 | — | 9 ms | 10 ms |
| `GET /director/private/reports/revenue/monthly` | director | 2 | — | 8 ms | 9 ms |
| `GET /mobile/private/auth/login/check` | mobile | 2 | 1 (50.0%) | 7 ms | 12 ms |

---
## 5. Localizações agregadas

| Coordenada (~1 km) | Onde é | Requisições | Usuários | IPs | Mapa |
|---|---|---|---|---|---|
| `-54.44, -36.55` | coordenada de teste (Atlântico Sul) | 9 | 1 | 1 | [abrir](https://www.google.com/maps?q=-54.44,-36.55) |
| `39.86, 116.47` | **fora do Brasil** — provável scanner/bot | 2 | 0 | 1 | [abrir](https://www.google.com/maps?q=39.86,116.47) |
| `-28.28, -54.26` | interior/Brasil — sem cidade na tabela (mais próxima: Caxias do Sul/RS, ~316 km) | 1 | 0 | 1 | [abrir](https://www.google.com/maps?q=-28.28,-54.26) |

> Coordenadas de teste (Atlântico Sul) aparecem em 9 requisição(ões) — tráfego interno de validação, não usuário real (ver CLAUDE.md, "Testes em Produção").

---
## 6. Erros (status ≥ 400)

| Rota | Ocorrências |
|---|---|
| `GET /` | 2 |
| `GET /mobile/public/place/discover` | 2 |
| `GET /robots.txt` | 2 |
| `GET /director/private/auth/login/check` | 1 |
| `GET /mobile/private/auth/login/check` | 1 |
| `GET /mobile/private/user` | 1 |

---
## 7. Como ler (e o que este relatório não diz)

- **Atribuição de login é inferida, não logada.** O login é rota pública e roda antes do `authenticateToken`, então a linha não tem `user_id`. O vínculo aqui é *mesmo IP + mesmo app + primeira requisição autenticada em até 15 min*. Confiável no volume atual; com muitos usuários por trás do mesmo NAT, deixa de ser.
- **Sem e-mail nem nome.** O log carrega `user_id` (UUID), por escolha de privacidade. Para resolver identidade, consultar o banco: `SELECT id, name, email, created_at FROM "user" WHERE id = '<uuid>';` (túnel em `ifute-compose/README.md`).
- **Localização só existe onde o app envia os headers.** Hoje `GET /mobile/public/place/discover` e `/place/city`. Usuário que não abriu a busca não tem coordenada — ausência aqui não é ausência de uso.
- **Rotas públicas não têm usuário.** `2.3%` das requisições são anônimas (públicas, webhooks, imagens, scanners); elas contam nos rankings globais mas não na seção por usuário.
- **`user_id` é o `sub` do JWT, não necessariamente uma pessoa.** Subjects que não são UUID (jobber/cron) saem na seção 3.1 e não contam como usuário.
- **A janela real pode ser menor que o `--since`.** A retenção do journald é de ~28 dias / 250 MB, mas **prospectiva**: não há histórico anterior a quando `Storage=persistent` foi habilitado no servidor. Confira sempre a linha "Janela analisada" no topo — é o intervalo que de fato existe, e um `--since` maior traz menos dados sem erro.

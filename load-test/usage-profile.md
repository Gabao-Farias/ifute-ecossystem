# Perfil de uso por usuário (base para análises de capacidade)

Documento de referência para traduzir **throughput medido (req/s)** — o que os
testes de carga produzem — em **número de usuários suportados**, que é a pergunta
de negócio. Atualize conforme coletarmos mais amostras reais.

> **Como usar:** `usuários ativos ≈ throughput_sustentável (req/s) ÷ req/s por usuário`.
> Combine com o teto de infra do último teste de carga
> ([results/](results/)) para estimar capacidade.

---

## Amostra 1 — sessão real capturada (2026-07-12, ~22:38 BRT)

Fonte: timeline do app mobile (`log-timeline-log-1783906815523.json`, na raiz do
meta-repo à época). **Uma** sessão de usuário logado, fluxo completo: abertura do
app → home → detalhe de local → consulta de pedidos/pagamento.

| Métrica | Valor |
|---|---|
| Janela | 01:38:16 → 01:39:38 UTC (~**82 s**) |
| Requisições | **24** (todas 2xx: 23×200, 1×201) |
| **Média** | **~0,29 req/s por usuário ativo** → **1 request a cada ~3,4 s** |
| Padrão | **rajadas de 3–5 reqs ao carregar cada tela**, seguidas de pausas de 6–12 s |

### Requisições por endpoint (nessa sessão)

| Endpoint | Chamadas |
|---|---|
| `/mobile/private/user/favorites` | 4 |
| `/mobile/private/place/appointmentOrders` | 4 |
| `/mobile/public/businessConfig` | 3 |
| `/mobile/public/place/discover` | 2 |
| `/mobile/private/user/recent` | 2 |
| `/mobile/private/place/recurrentAppointment` | 2 |
| `/mobile/private/place?place_id=` | 2 |
| `/mobile/private/payment/order/:id` | 2 |
| `/mobile/private/user` | 1 |
| `/mobile/private/user/fcmtoken` (POST) | 1 |
| `/mobile/private/auth/login/check` | 1 |

Observações:
- Tráfego **não é constante**: chega em rajadas de fan-out ao trocar de tela
  (ex.: `recent`+`discover`+`favorites`+`place`+`businessConfig` em <1 s), depois
  6–12 s de leitura/interação.
- Sessão de **uso intenso e contínuo** (login + navegação + consulta de pedidos) —
  representa um usuário mais pesado que a média, então a estimativa derivada é
  **conservadora**.

---

## Estimativa de capacidade derivada

Aplicando **0,29 req/s por usuário ativo** ao teto do cluster pós-task 26
(3 workers — ver [RELATORIO-cluster-2026-07-22_2025Z.md](results/RELATORIO-cluster-2026-07-22_2025Z.md)):

| Base de throughput | Cálculo | Usuários **continuamente ativos** |
|---|---|---|
| Sucesso medido no pico (~146 req/s) | 146 ÷ 0,29 | **~500** |
| Teto sustentável estimado (~200 req/s) | 200 ÷ 0,29 | **~690** |

Leitura:
- **~500–700 usuários simultâneos** é o pior caso (todos em uso ativo e contínuo).
- Com o padrão real **rajada + pausa**, boa parte da concorrência está em pausa de
  leitura → a base de usuários com o app aberto sobe para **alguns milhares**, e a
  de cadastrados para **dezenas de milhares**.

---

## Limitações / próximos passos

- **n = 1 sessão.** Amostra pequena e de um usuário pesado. Para robustez, coletar
  mais sessões ou extrair `req/s por usuário` dos logs de acesso do nginx num
  intervalo real (agrupando por IP/token).
- Só o **caminho de leitura** entra no teto de infra medido; escrita/pagamento
  (order → Asaas) não foi testado sob carga.
- Reavaliar quando: (a) houver cache de leitura no `discover` (muda o teto de
  infra), ou (b) o mix de telas do app mudar (muda req/s por usuário).

# Relatório — Rastreio de acesso de usuário em produção (Rodrigo)

**Data da análise:** 16/08/2026
**Escopo:** identificar a atividade do usuário `romoraesilva@gmail.com` na plataforma iFute em produção
**Fontes:** journald (`ifute-core-simple` + `nginx`), banco PostgreSQL de produção
**Relatório automático da janela:** [`2026-08-16-logins-rotas-prod.md`](2026-08-16-logins-rotas-prod.md)

> ⚠️ **Este documento contém dados pessoais** (e-mail, endereço IP, localização aproximada, identificadores de conta). Uso interno. Sob a LGPD, o tratamento aqui se justifica como análise de comportamento na própria plataforma, mas o arquivo não deve ser publicado nem compartilhado externamente.

---

## 1. Sumário executivo

O usuário existe, é real, e teve **uma única sessão de 68 segundos** hoje (16/08/2026, 12:30:19 → 12:31:27 BRT), pelo **app Android**, a partir do **Rio de Janeiro (Zona Sul)**. Fez **23 requisições**, criou a conta via Google no meio da sessão, e saiu.

**É o mesmo caso do [Marcos, em 08/08](2026-08-08-rastreio-usuario-prod.md) — repetido oito dias depois, com um detalhe novo e caro: agora sabemos onde.** As **11 buscas** que ele disparou responderam `places_in_radius: 0, eligible: 0, results: 0`. Produção continua com **4 Places, todas de teste** nas coordenadas do Atlântico Sul. Ele viu tela vazia, se cadastrou assim mesmo, insistiu mais quatro vezes em intervalos de 3 segundos, conferiu se tinha algum agendamento, e abandonou.

Três coisas mudam em relação ao rastreio anterior:

1. **A localização foi capturada.** É o primeiro caso em que a instrumentação do G2 (task 30) entregou o que prometia. `-22.96, -43.17` — Rio de Janeiro, Zona Sul.
2. **Ele não é o único.** Há mais **dois dispositivos Android orgânicos** na janela de 7 dias, em duas outras regiões (Maringá/PR e norte de Minas), nenhum dos quais chegou a criar conta. A demanda que chega é geograficamente **espalhada** — que é exatamente o cenário contra o qual o [plano de vendas](2026-08-12-plano-vendas-donos-quadra.md) alerta.
3. **Um bug de primeira impressão foi confirmado, não mais suposto.** A primeira chamada de busca de **todo cliente novo** falha com `400`.

---

## 2. Identificação do usuário

| Campo | Valor |
|---|---|
| `user_id` | `7131bb48-ac4a-4848-84be-0a6cce4d168f` |
| E-mail | `romoraesilva@gmail.com` |
| Nome | Rodrigo |
| `created_at` | 2026-08-16 15:30:38.79 UTC (12:30:38 BRT) |
| `deleted_at` | `null` (conta ativa) |
| Método de autenticação | Google Sign-In |
| Plataforma | **app Android** — `okhttp/4.9.2` |
| IP | `179.218.10.149` |
| Localização (log, ~1 km) | `-22.96, -43.17` — [Rio de Janeiro/RJ, Zona Sul](https://www.google.com/maps?q=-22.96,-43.17) |
| `tz_offset` | 180 (BRT — consistente com a coordenada) |

**Pegada no banco de dados:**

| Tabela | Registros |
|---|---|
| `user_fcm_token` | **1** |
| `court_appointment_order` | 0 |
| `court_recurrent_appointment` | 0 |
| `user_favorite` | 0 |
| `user_recent` | 0 |
| `user_report` | 0 |

Idêntica à do Marcos: **nenhuma transação, nenhum agendamento, nenhuma interação persistida.** O único artefato é o token de push — ou seja, **ele é alcançável por notificação**, e desta vez sabemos para qual região faria sentido notificá-lo.

---

## 3. Timeline completa da sessão

Sessão única: **12:30:19 → 12:31:27 BRT** (15:30:19 → 15:31:27 UTC). Duração: **68 segundos**. 23 requisições.

Reconstruída pelo IP (não só pelo `user_id`), porque `discover` e `city` são rotas **públicas** — não carregam `user_id` mesmo com o usuário logado. Sem isso, metade da sessão ficaria invisível.

| Hora (BRT) | Δ | Rota | Status | Resultado da busca | Interpretação |
|---|---|---|---|---|---|
| 12:30:19 | — | `GET /mobile/public/businessConfig` | 200 | — | App abriu |
| 12:30:19 | +0s | `GET /mobile/private/auth/login/check` | 401 | — | Sem sessão — fluxo normal |
| 12:30:19 | +0s | `GET /mobile/public/place/discover` | **400** | — | **Bug**: disparou sem `lat`/`lon` (§5) |
| 12:30:20 | +1s | `GET /mobile/public/place/discover` | 200 | `radius 0 / eligible 0 / results 0` | Permissão de local resolveu. **Tela vazia** |
| 12:30:24 | +3s | `GET /mobile/public/place/city` | 200 | `radius 0 / eligible 0 / results 0` | Tentou a busca por cidade. Vazia |
| 12:30:31 | +6s | `GET /mobile/private/user` | 401 | — | Tocou em área logada |
| 12:30:38 | +7s | `POST /mobile/public/auth/login/google` | 200 | — | **Criou a conta** — depois de ver tudo vazio |
| 12:30:39 | +0s | `GET /mobile/private/user` | 200 | — | Perfil carregado |
| 12:30:39 | +0s | `GET /mobile/public/place/discover` | 304 | `radius 0 / eligible 0 / results 0` | Recarregou logado. **Continua vazio** |
| 12:30:39 | +0s | `POST /mobile/private/user/fcmtoken` | 201 | — | Push registrado |
| 12:31:09 | +29s | `city` + `discover` + `user/recent` | 304/200 | `0 / 0 / 0` | 1ª insistência |
| 12:31:12 | +3s | `user/recent` + `discover` + `city` | 304 | `0 / 0 / 0` | 2ª insistência |
| 12:31:15 | +3s | `user/recent` + `city` + `discover` | 304 | `0 / 0 / 0` | 3ª insistência |
| 12:31:18 | +3s | `city` + `discover` + `user/recent` | 304 | `0 / 0 / 0` | 4ª insistência |
| 12:31:27 | +8s | `GET /mobile/private/place/appointment` | 200 | — | "Será que tenho algo marcado?" → vazio → saiu |

**As quatro repetições de 3 em 3 segundos são o achado comportamental.** Não é o app fazendo polling: são intervalos irregulares (29s, 3s, 3s, 3s) intercalados com `user/recent`, o padrão de quem alterna entre abas e puxa para atualizar. **Ele achou que era falha de carregamento, não ausência de conteúdo.** Se a tela vazia dissesse "ainda não temos quadras na sua região — avise quando tivermos", esses 40 segundos de frustração viravam um lead qualificado com região declarada.

### Resumo das buscas

| Métrica | Valor |
|---|---|
| Buscas bem-sucedidas (`discover` + `city`) | **11** (6 + 5) |
| Buscas com `places_in_radius > 0` | **0** |
| Buscas com `eligible > 0` | **0** |
| Buscas com `results > 0` | **0** |
| Coordenada em todas | `-22.96, -43.17` |

`places_in_radius: 0` (e não `eligible: 0` com `radius > 0`) é o diagnóstico exato: **falta de oferta**, não falta de ativação. Não há quadra alguma no raio — não é caso de dono sem chave PIX.

---

## 4. Não é um caso isolado — mais dois Androids na janela

Buscando por User-Agent na janela de 7 dias, aparecem **três** IPs Android distintos (o app iOS soma outros 203 requests, mas quase todos do próprio time):

| IP | Quando | Onde (log, ~1 km) | O que fez | Cadastrou? |
|---|---|---|---|---|
| `179.218.10.149` | 16/08 12:30 | `-22.96, -43.17` — **Rio de Janeiro/RJ** (Zona Sul) | 11 buscas, todas vazias | ✅ **sim** (Rodrigo) |
| `170.254.113.26` | 15/08 16:43 | `-23.45, -51.88` — **Maringá/PR** (~7 km do centro) | 4 buscas, todas vazias | ❌ não |
| `177.36.194.160` | 13/08 19:40 e 14/08 09:59 | `-16.38, -44.44` — **norte de Minas** (~70 km a NO de Montes Claros) | só abriu o app (2 dias distintos), não chegou a buscar | ❌ não |

> Rótulos de cidade calculados offline (tabela do script + haversine). Maringá e Rio são confiáveis; o do norte de Minas é uma estimativa — a região não está na tabela de cidades do script, que a classifica genericamente como "interior/Brasil".

Duas leituras, e a segunda importa mais:

- **Boa:** existe demanda orgânica recorrente. Em 7 dias, três dispositivos reais e desconhecidos abriram o app sem nenhuma campanha ativa. O de Montes Claros **voltou num segundo dia** — sinal de intenção acima da média.
- **Ruim:** as três estão em regiões diferentes, a ~800–1.000 km uma da outra. É a materialização exata do "erro que mata o projeto" descrito no [plano de vendas](2026-08-12-plano-vendas-donos-quadra.md): demanda pulverizada não vira densidade. **Nenhuma dessas três regiões se reforça.**

Contexto de base: **35 usuários** no banco (Rodrigo é o mais recente), e o ritmo de cadastro é de ~1 a cada 8 dias — 08/08 (Marcos), 16/08 (Rodrigo).

---

## 5. Bug confirmado — o primeiro `discover` de todo cliente falha com `400`

A ação nº 3 do [relatório de 08/08](2026-08-08-rastreio-usuario-prod.md) suspeitava de uma corrida entre a permissão de localização e a primeira chamada. **Confirmado, e é universal.**

Na janela de 7 dias:

| Status do `GET /mobile/public/place/discover` | Requisições | IPs distintos |
|---|---|---|
| `400` | 4 | **4** |
| `200` | 8 | 4 |
| `304` | 7 | 3 |

**4 erros `400` em 4 IPs distintos** — um por cliente, sempre o primeiro. O evento `Problematic header data` aparece exatamente 4 vezes, casando 1:1.

**Causa:** [`cityPlaceDiscovery`](../../ifute-core-simple/src/apps/mobile/utils/validators/place.ts#L3-L26) exige `lat` e `lon` como número. O app faz a primeira chamada antes de a permissão de localização resolver, os headers vão vazios, `Number(undefined)` vira `NaN`, o Zod rejeita e o [`validateHeader`](../../ifute-core-simple/src/apps/mobile/middlewares/headerValidators.ts#L19-L24) devolve `400` em produção.

**Impacto real: baixo, mas não nulo.** O app se recupera sozinho ~1 segundo depois (na sessão do Rodrigo, `400` às 12:30:19 e `200` às 12:30:20), então o usuário provavelmente não vê erro. O custo é que **toda primeira impressão passa por um erro**, e que os `400` poluem o funil de busca: são requisições que não emitem `place_discover` e portanto **não contam no mapa de demanda** — a região de quem desistir exatamente nesse 1 segundo fica invisível.

**Correção sugerida (app, não backend):** segurar a primeira chamada até a permissão resolver. Alternativa no backend: tratar `lat`/`lon` ausentes como busca sem geolocalização em vez de `400` — mas isso mudaria semântica de rota e não é o lugar certo do conserto.

---

## 6. Comparação com o caso de 08/08

| | Marcos (08/08) | Rodrigo (16/08) |
|---|---|---|
| Plataforma | app iOS (build 37) | **app Android** |
| Duração da sessão | 100s | 68s |
| Requisições | 11 | **23** |
| Buscas disparadas | 3 (inferidas por `body_bytes`) | **11 (medidas)** |
| Localização | **irrecuperável** | **`-22.96, -43.17` (Rio/RJ)** |
| Cadastrou? | sim, no meio da sessão | sim, no meio da sessão |
| Transações | 0 | 0 |
| Voltou? | não | não |
| Esforço da análise | inferência temporal por IP, 3 passos | `grep` direto |

O contraste na última linha é o retorno da task 30: o que em 08/08 exigiu correlacionar access log do nginx com `created_at` do banco, hoje saiu de uma consulta. **E a linha que mais importa é a da localização** — o gap G2 era a "pergunta de negócio mais valiosa" do relatório anterior, e agora ela tem resposta.

---

## 7. Ações sugeridas

**Sobre o produto:**

1. **Nada mudou no bloqueio principal: não existe uma única quadra real em produção.** São 4 Places, todas em South Georgia. Este é o segundo usuário orgânico em 8 dias a bater nessa parede, e o quinto dispositivo real contando os que não se cadastraram.
2. **A tela vazia precisa dizer que está vazia.** As quatro insistências do Rodrigo mostram que ele leu a tela como erro de carregamento. Um estado vazio explícito — *"ainda não atendemos [cidade]. Quer ser avisado quando chegarmos?"* — converteria frustração em (a) um lead com consentimento e (b) um voto registrado de demanda por região. **É a mudança de maior valor por esforço deste relatório**, e não depende de cadastrar nenhuma quadra para valer a pena.
3. **Rio de Janeiro/Zona Sul é o primeiro dado concreto de escolha de região.** Não é conclusivo com n=1 — mas é o único ponto do mapa com cadastro efetivo, é uma capital (densidade de arenas de society e beach tennis alta, ICP 1 e 2 do plano de vendas), e resolve a favor de saturar uma região em vez de espalhar.
4. **Corrigir o `400` do primeiro `discover`** (§5) — baixo impacto de UX, mas fecha um furo no mapa de demanda.

**Sobre contato:**

5. **Rodrigo é um lead recuperável e, diferente do Marcos, endereçável.** Conta ativa, token FCM válido, e região conhecida. **Não vale contato agora** — não há o que oferecer, e um segundo contato com tela vazia queima o lead. Vale (a) quando houver quadra no Rio, ou (b) já agora, no mesmo formato de pesquisa sugerido para o Marcos: perguntar em que quadra ele joga. A resposta é lista de prospecção qualificada na única região que já converteu.
6. Os outros dois dispositivos (Maringá, norte de MG) **não são endereçáveis** — não criaram conta, não há e-mail nem token. Ficam só como sinal de demanda no mapa.

**Sobre o rastreio:**

7. **G4 (eventos de auth) subiu de prioridade.** O cadastro do Rodrigo só foi datável pelo `created_at` da tabela `user`; a linha do `POST /auth/login/google` não distingue signup de login recorrente. Com o volume crescendo, "quantos cadastros novos esta semana?" deveria ser um `grep`, não um `SELECT`.
8. **O ponto cego de `discover`/`city` serem rotas públicas custou trabalho de novo.** A seção do Rodrigo no relatório automático mostra 7 requisições; a sessão real tem 23, e **todas as 11 buscas** estão na metade invisível. Enquanto essas rotas não tiverem `user_id`, todo rastreio individual exige reconstrução por IP.

---

## Anexo — Comandos usados

```sh
# Relatório automático da janela (gera reports/AAAA-MM-DD-logins-rotas-prod.md)
node scripts/analyze-prod-logins.mjs --since "7 days ago"

# Identificar o usuário no banco
ssh -p 51765 root@api.ifute.com.br \
  'docker exec -i ifute-postgresdb-1 sh -c "psql -U \$POSTGRES_USER_NAME -d \$POSTGRES_DATABASE_NAME -f -"' \
  <<< "select user_id, email, name, created_at, deleted_at from \"user\" where email ilike '%romoraesilva%';"

# Sessão completa — pelo IP, para capturar também as rotas públicas.
# ⚠️ o servidor interpreta --since/--until em horário LOCAL (BRT), não UTC;
#    o campo `time` das linhas do pino é UTC. Não confundir os dois.
ssh -p 51765 root@api.ifute.com.br \
  'journalctl CONTAINER_TAG=ifute-core-simple --since "2026-08-16 12:00" --until "2026-08-16 13:30" -o cat --no-pager' \
  | grep '179.218.10.149'

# Dispositivos mobile por User-Agent (o UA só existe no log do nginx)
ssh -p 51765 root@api.ifute.com.br \
  'journalctl CONTAINER_TAG=nginx --since "7 days ago" -o cat --no-pager' \
  | grep -E 'okhttp|iFute' | awk '{print $1}' | sort | uniq -c | sort -rn

# Funil de busca por região: eligible = 0 é demanda não atendida
ssh -p 51765 root@api.ifute.com.br \
  'journalctl CONTAINER_TAG=ifute-core-simple --since "7 days ago" -o cat --no-pager' \
  | grep '"event":"place_' | grep '"eligible":0'
```

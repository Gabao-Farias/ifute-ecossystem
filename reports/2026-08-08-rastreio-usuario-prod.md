# Relatório — Rastreio de acesso de usuário em produção

**Data da análise:** 08/08/2026
**Escopo:** identificar a atividade do usuário `marcoshuf84@gmail.com` na plataforma iFute em produção
**Fontes:** access log do nginx, log do container `ifute-core-simple`, banco PostgreSQL de produção

> ⚠️ **Este documento contém dados pessoais** (e-mail, endereço IP, identificadores de conta). Uso interno. Sob a LGPD, o tratamento aqui se justifica como análise de comportamento na própria plataforma, mas o arquivo não deve ser publicado nem compartilhado externamente.

---

## 1. Sumário executivo

O usuário existe, é real, e teve **uma única sessão de 100 segundos** no dia da própria análise (08/08/2026, 10:24:49 → 10:26:29 BRT), pelo app iOS. Fez **11 requisições**, criou a conta via Google no meio da sessão, e saiu.

**Ele demonstrou intenção clara de uso — e não conseguiu usar nada.** Todos os endpoints de listagem responderam vazio (`[]`), porque **não existe uma única quadra real cadastrada em produção**: as 4 Places do banco são todas de teste, nas coordenadas fixas do Atlântico Sul. Ele viu uma tela vazia, se cadastrou de qualquer forma, procurou conteúdo em três lugares diferentes e abandonou.

Não é um caso de bug. É um caso de **ausência de oferta** — e o rastreio atual quase não permitiu chegar a essa conclusão, o que revela um problema secundário tão relevante quanto o primeiro (seção 6).

---

## 2. Metodologia — como o usuário foi localizado

Vale registrar porque a dificuldade aqui **é em si um achado**.

O log de requisições do backend ([`loggerMiddleware`](../ifute-core-simple/src/shared/middlewares/log.ts), aplicado globalmente em [`app.ts:17`](../ifute-core-simple/src/app.ts#L17)) registra apenas `{ip, path}`:

```ts
logger.info({ ip, path }, "Incoming request");
```

Consequência: **grep pelo e-mail ou pelo `user_id` nos logs retorna zero resultados.** Só 7 pontos do código inteiro logam `user_id`, todos ligados a criação de agendamento ou exclusão de conta — nenhum deles foi acionado por este usuário.

A correlação foi feita em três passos:

| Passo | Ação | Resultado |
|---|---|---|
| 1 | Consulta ao banco por e-mail | `user_id = ea6da5d5-51d8-411c-858f-4d2315449648`, `created_at = 2026-08-08 13:25:48.957 UTC` |
| 2 | Busca no access log do nginx por `POST /mobile/public/auth/login/google` na janela do `created_at` | Um único hit, às **13:25:48 UTC**, do IP `189.40.69.84` — casamento ao segundo com o `created_at` |
| 3 | Validação cruzada por build do app | `iFute/37` foi usado por apenas 5 IPs; `189.40.69.84` é o **único IP externo real** (os outros são a máquina de dev e infra da Apple) |

Distribuição de IPs no build `iFute/37`:

| IP | Requisições | Quem é |
|---|---|---|
| `189.7.228.9` | 63 | máquina de desenvolvimento (também usa o master-backoffice em `localhost:7104`) |
| `189.40.69.84` | 11 | **o usuário analisado** |
| `139.178.131.10` | 7 | Equinix Metal — App Review / TestFlight |
| `17.185.64.100` | 3 | Apple (`17.0.0.0/8`) |
| `17.185.64.84` | 3 | Apple (`17.0.0.0/8`) |

**Grau de confiança: alto.** O casamento de milissegundo entre o `created_at` da conta e o `POST` de login, somado ao isolamento do IP no build 37, torna a atribuição praticamente inequívoca. Ainda assim, ela foi obtida por *inferência temporal*, não por dado explícito — é um método que só funcionou porque o volume de tráfego é baixíssimo. Com 100 usuários simultâneos, não funcionaria.

---

## 3. Identificação do usuário

| Campo | Valor |
|---|---|
| `user_id` | `ea6da5d5-51d8-411c-858f-4d2315449648` |
| E-mail | `marcoshuf84@gmail.com` |
| Nome | Marcos |
| `created_at` | 2026-08-08 13:25:48.957 UTC (10:25:48 BRT) |
| `deleted_at` | `null` (conta ativa) |
| Método de autenticação | Google Sign-In |
| Plataforma | iOS — `iFute/37 CFNetwork/3860.600.12 Darwin/25.5.0` |
| IP | `189.40.69.84` |

**Pegada no banco de dados:**

| Tabela | Registros |
|---|---|
| `user_fcm_token` | **1** (token `c9CRkDRMk0tCr3PU6C4gK9:APA91bG8...`) |
| `court_appointment_order` | 0 |
| `court_recurrent_appointment` | 0 |
| `user_favorite` | 0 |
| `user_recent` | 0 |
| `user_report` | 0 |

Ou seja: **nenhuma transação, nenhum agendamento, nenhuma interação persistida.** O único artefato deixado foi o registro de push notification — o que, incidentalmente, significa que **ele é alcançável por notificação** (ver seção 7).

---

## 4. Padrão de acesso

### 4.1 Timeline completa

Sessão única: **10:24:49 → 10:26:29 BRT** (13:24:49 → 13:26:29 UTC). Duração: **100 segundos**. 11 requisições.

| # | Hora (BRT) | Δ | Método e rota | Status | Bytes | Interpretação |
|---|---|---|---|---|---|---|
| 1 | 10:24:49 | — | `GET /mobile/public/businessConfig` | 200 | 230 | app abriu, carregou config |
| 2 | 10:24:50 | +1s | `GET /mobile/private/auth/login/check` | 401 | 83 | sem sessão (esperado) |
| 3 | 10:24:50 | +0s | `GET /mobile/public/place/discover` | 200 | **2** | **home vazia** (`[]`) |
| 4 | 10:24:59 | +9s | `GET /mobile/public/place/city` | 200 | **2** | **busca por cidade vazia** (`[]`) |
| 5 | 10:25:05 | +6s | `GET /mobile/private/user` | 401 | 83 | abriu perfil deslogado |
| 6 | 10:25:48 | +43s | `POST /mobile/public/auth/login/google` | 200 | 206 | **cadastro + login** |
| 7 | 10:25:49 | +1s | `GET /mobile/public/place/discover` | 304 | 0 | home recarregada, ainda vazia |
| 8 | 10:25:49 | +0s | `GET /mobile/private/user` | 200 | 314 | perfil carregado |
| 9 | 10:25:49 | +0s | `POST /mobile/private/user/fcmtoken` | 201 | 5 | push registrado |
| 10 | 10:25:56 | +7s | `GET /mobile/private/user/favorites` | 200 | **2** | **favoritos vazios** (`[]`) |
| 11 | 10:26:29 | +33s | `GET /mobile/private/place/appointment` | 200 | **2** | **"meus agendamentos" vazio** (`[]`) |

Fim. Nenhuma requisição posterior até o momento desta análise (12:50 BRT).

### 4.2 Três fases distintas

**Fase 1 — exploração anônima** (#1–#5, 16 segundos)
Abriu o app, a home veio vazia, tentou a busca por cidade, também vazia, e foi ao perfil.

**Fase 2 — decisão de se cadastrar** (#6, com 43s de intervalo antes)
Os 43 segundos entre #5 e #6 correspondem ao fluxo nativo de OAuth do Google: tela de seleção de conta, consentimento, retorno ao app. É o maior intervalo da sessão e o mais informativo.

**Fase 3 — verificação pós-login** (#7–#11, 41 segundos)
Perfil, registro de push, favoritos e agendamentos. Tudo vazio. Encerrou.

### 4.3 Observações sobre o padrão

- **Zero requisições a `/images/`.** Nenhum asset de quadra foi solicitado em toda a sessão. Isso é a prova técnica mais direta de que **nada renderizou na tela** — não houve um único card de local exibido. Para comparação, uma sessão com conteúdo carrega 4 a 8 imagens (`GET /images/public/*.jpg|png`).
- **Todos os endpoints de lista devolveram 2 bytes**, ou seja, o literal `[]`.
- **Nenhum erro real.** Os três `401` são do fluxo normal pré-autenticação (rotas `private` sem token). Nenhum `4xx` inesperado, nenhum `5xx`. A plataforma funcionou como programada — o problema não é técnico.
- **Ritmo humano, não automatizado.** Intervalos de 9s, 6s, 43s, 7s e 33s são incompatíveis com script. Somado ao build real de app iOS, conta Google legítima e token FCM válido, descarta-se bot ou scanner.
- **O `304` em #7** indica que o app reaproveitou o cache do `discover` — o backend confirmou que o resultado não mudou. Vazio antes, vazio depois do login.

---

## 5. Houve intenção de uso?

**Sim, e forte.** A leitura mais óbvia — "abriu por curiosidade e desistiu" — não se sustenta diante da sequência. Quatro evidências:

**1. Ele buscou ativamente, não apenas olhou a home.**
A chamada #4 (`/place/city`) é disparada por uma ação deliberada de busca por cidade, não pelo carregamento inicial. Ele não se contentou com a home vazia: tentou procurar. Este é o sinal mais forte do conjunto.

**2. Ele pagou o custo do cadastro depois de ver valor zero.**
A ordem importa muito. Ele viu a home vazia (#3) e a busca vazia (#4) **antes** de se cadastrar (#6). Consentir OAuth do Google — entregar e-mail e nome a um app desconhecido, atravessar duas telas de sistema — é atrito real. Quem cadastra *após* constatar que não há nada disponível está apostando que o conteúdo aparece depois do login. É comportamento de quem quer usar o produto, não de quem está passando o olho.

**3. Ele procurou conteúdo em três lugares diferentes.**
`discover` (#3, #7), `city` (#4) e `favorites`/`appointment` (#10, #11). Os dois últimos são especialmente reveladores: checar "meus agendamentos" numa conta criada 40 segundos antes só faz sentido se a pessoa está procurando ativamente onde o conteúdo se esconde.

**4. Ele permaneceu 100 segundos numa tela vazia.**
Abandono por desinteresse acontece em 10–20 segundos. Cem segundos com zero conteúdo indicam alguém tentando entender se estava fazendo algo errado.

**Conclusão:** este é o perfil de um lead qualificado que chegou cedo demais. A intenção estava presente; a oferta, não. O churn não foi causado por fricção de produto, preço ou bug — foi causado por estoque vazio.

---

## 6. Causa raiz do resultado vazio

Não há defeito no código. O endpoint [`getCityPlacesSuggestions`](../ifute-core-simple/src/apps/mobile/services/place.service.ts#L123) filtra Places por raio de distância a partir do `lat`/`lon` do usuário e retorna `[]` quando nada é encontrado — comportamento correto.

O problema é o conteúdo do banco. **As 4 únicas Places em produção são todas de teste**, nas coordenadas convencionadas do Atlântico Sul (ver `CLAUDE.md` → "Testes em Produção"):

| Place | `lat` | `lon` | Cidade registrada |
|---|---|---|---|
| Arena Tester | -54.441196 | -36.554195 | South Georgia |
| Paddel Tennis | -54.420810 | -36.598103 | South Georgia |
| Volley Island | -54.442562 | -36.503803 | South Georgia |
| Arena Bagual | -54.441196 | -36.598110 | South Georgia |

Qualquer usuário fisicamente no Brasil está a milhares de quilômetros do único cluster de quadras existente. O resultado vazio é **matematicamente inevitável** para 100% dos usuários reais.

Isso é confirmado pela distribuição de respostas do `discover` no log do nginx (janela de 22/07 a 08/08):

| Status | Bytes | Ocorrências | Origem |
|---|---|---|---|
| 200 | 6301 / 6118 / 6698 / 6801 | 16 | **todas** de `189.7.228.9` (máquina de dev, usando coordenadas de teste) |
| 200 | 2 (`[]`) | 10 | usuários/coordenadas reais |
| 304 | 0 | 27 | cache |
| 400 | 81 | 10 | header `lat`/`lon` ausente ou inválido |

**Nenhuma resposta com dados reais jamais saiu para um IP que não fosse o da máquina de desenvolvimento.** Em outras palavras: nenhum usuário externo, em nenhum momento da janela de log disponível, viu uma quadra no app.

> Nota lateral: os **10 erros `400`** no `discover` merecem investigação própria. Ocorrem quando o app chama o endpoint sem `lat`/`lon` válidos nos headers — provavelmente antes de a permissão de localização ser concedida. Um deles aconteceu num teste Android às 14:57 do mesmo dia, seguido imediatamente por um retry bem-sucedido, o que sugere condição de corrida no app entre a obtenção da localização e a primeira chamada.

---

## 7. Localização do usuário

**Resposta curta: não é determinável com precisão útil.** O que se sabe com certeza, a partir do IP `189.40.69.84`:

| Campo | Valor |
|---|---|
| Operadora | **TIM CELULAR S.A.** |
| ASN | AS26615 |
| Bloco | `189.40.64.0/19` (`inetnum-up: 189.40.0.0/16`) |
| País | BR |
| rDNS | `84.69.40.189.isp.timbrasil.com.br` |
| Tipo | rede móvel (4G/5G) |

Duas razões pelas quais não se pode ir além de "Brasil, rede móvel TIM":

1. **O rDNS da TIM não carrega informação geográfica.** É puramente aritmético — IP invertido + domínio fixo. Verificado testando vizinhos do bloco (`.1`, `.50`, `.100`, `.200`): todos seguem o mesmo padrão, sem código de POP ou cidade. Algumas operadoras embutem siglas regionais no rDNS; a TIM, neste bloco, não.
2. **O bloco `/19` está registrado nacionalmente no registro.br**, sem cidade, e tráfego móvel sai por CGNAT em gateways regionais. Bases de geoIP comerciais tipicamente atribuem esses blocos ao centróide do estado ou a São Paulo por padrão — um palpite com aparência de dado.

### 7.1 A coordenada exata existiu e foi descartada

Este é o ponto crítico. O app envia `lat`, `lon`, `day` e `timezoneoffset` **em headers HTTP** nas chamadas `/place/discover` e `/place/city` (ver [`cityPlaceDiscovery`](../ifute-core-simple/src/apps/mobile/utils/validators/place.ts#L3)). O usuário fez ambas as chamadas. **O backend recebeu a posição precisa dele às 10:24:50 e 10:24:59.**

Nada disso foi preservado:

- o `log_format main` do nginx não registra headers customizados;
- o `loggerMiddleware` do core registra apenas `{ip, path}`;
- nenhuma tabela armazena localização de usuário — `lat`/`lon` só existem em `place_location`;
- o app mobile tem `@react-native-firebase/app`, `messaging` e `remote-config`, mas **não tem `analytics`** — portanto não há dado geográfico no console do Firebase/GA4 para consultar.

A localização desta sessão é irrecuperável. E, com ela, a resposta à pergunta de negócio mais valiosa que este evento poderia responder: **em qual cidade existe demanda não atendida?**

---

## 8. Gaps de rastreio e recomendações

Ordenados por relação valor/esforço.

### G1 — Nenhum `user_id` nos logs de requisição
**Impacto:** impossível responder "o que este usuário fez?" sem inferência temporal por IP. O método usado nesta análise só funcionou porque havia 2 IPs ativos no dia; não escala.
**Correção:** incluir `req.user?.sub` no log das rotas autenticadas. O `loggerMiddleware` é global e roda antes do `authenticateToken`, então precisa de um segundo middleware após a autenticação, ou de leitura tardia via `res.on("finish")`.
**Esforço:** baixo.

### G2 — Headers de geolocalização descartados
**Impacto:** não se sabe de onde vem a demanda. Cada busca vazia é um sinal de mercado perdido.
**Correção:** logar `lat`/`lon` **arredondados a 2 casas decimais** (~1 km de precisão) e `timezoneoffset` nas rotas que já os recebem. O arredondamento não é preciosismo: coordenada exata de pessoa física é dado pessoal sob LGPD e iria para log de container. Resolver para nome de cidade na análise, não no caminho da requisição — já existe reverse geocoding no projeto ([`APILocation`](../ifute-core-simple/src/shared/api/location.ts), OpenWeatherMap), mas chamá-lo por requisição adicionaria latência e custo.
**Esforço:** baixo. **Maior retorno de negócio do conjunto.**

### G3 — Buscas vazias não são medidas
**Impacto:** a métrica mais importante do estágio atual do produto — "quantas pessoas procuraram quadra e não acharam nada, e onde" — não existe. Nesta análise, só foi possível detectar o resultado vazio porque o nginx registra `$body_bytes_sent` e `[]` tem 2 bytes. É forense, não observabilidade.
**Correção:** logar a contagem de resultados em `discover` e `city` (ex.: `logger.info({ user_id, lat, lon, results: places.length }, "place_discover")`). Um contador de `results: 0` por região passa a ser o mapa de prospecção de quadras.
**Esforço:** baixo.

### G4 — Eventos de autenticação não são logados
**Impacto:** o cadastro deste usuário só foi detectável pelo `created_at` na tabela `user`. Não há registro de logins bem-sucedidos, tentativas falhas, ou distinção entre primeiro login e login recorrente. `auth.service.ts` não usa o logger.
**Correção:** logar `signup` e `login` como eventos explícitos, com `user_id` e se a conta foi criada naquela chamada.
**Esforço:** baixo.

### G5 — `401` ambíguos
**Impacto:** um `401` em rota `private` pode ser fluxo normal pré-login (como os três desta sessão) ou sessão expirada/token inválido. Nos logs, são indistinguíveis — impossível medir quebra de sessão.
**Correção:** diferenciar no log o motivo do `401` (token ausente vs. inválido vs. expirado).
**Esforço:** baixo.

### G6 — Sem `request-id` de correlação
**Impacto:** o core roda em **cluster de N workers** (task 26), todos escrevendo no mesmo stdout. Linhas de log da mesma requisição não podem ser agrupadas, e não há como saber qual worker atendeu o quê.
**Correção:** gerar um `X-Request-Id` (ou aceitar o do nginx) e incluí-lo em toda linha de log, junto do `process.pid`.
**Esforço:** médio.

### G7 — Sem métrica de latência
**Impacto:** o `log_format main` do nginx é o padrão de fábrica: não inclui `$request_time` nem `$upstream_response_time`. Não há dado de performance por rota em produção — o que é especialmente relevante dado o gargalo de CPU já identificado no teste de carga.
**Correção:** adicionar `$request_time` e `$upstream_response_time` ao `log_format` em `ifute-compose/nginx/`. Mudança de configuração, aplicável via `deploy-prd.sh`.
**Esforço:** trivial.

### G8 — Retenção curta e sem histórico durável
**Impacto:** a janela de investigação é acidental. O log do core cobria **apenas desde 05/08 14:43** (container recriado, arquivo único de 15 MB, ainda sem rotação). O do nginx cobria desde ~09/07 (`50m` × 4 arquivos, 186 MB). Este usuário se cadastrou no mesmo dia da análise — foi sorte. Um cadastro de 20 dias antes teria deixado rastro parcial; de 40 dias, nenhum.
**Correção:** para eventos de negócio (signup, login, busca vazia, agendamento), gravar em **tabela de eventos no Postgres**, não em log de container. Log rotativo serve para depuração, não para análise de comportamento. Alternativa mínima: aumentar `max-file` no `docker-compose.yml`.
**Esforço:** médio (tabela) ou trivial (retenção).

### G9 — Sem analytics no app mobile
**Impacto:** não há funil, não há tela vista, não há retenção/DAU, não há sessão. Todo o comportamento precisa ser reconstruído a partir de requisições HTTP, que só revelam o que chega ao servidor — não o que o usuário viu ou tocou. O app tem Firebase para push e remote-config, mas não `@react-native-firebase/analytics`.
**Correção:** avaliar a inclusão de analytics. Como o Firebase já está instalado, o incremento é pequeno.
**Esforço:** médio. **Decisão de produto, não só técnica** — envolve consentimento e política de privacidade.

---

## 9. Ações sugeridas

**Sobre o produto (mais urgente que o rastreio):**

1. **Cadastrar quadras reais é o único bloqueio que importa.** Nenhuma melhoria de instrumentação muda o fato de que hoje 100% dos usuários reais veem tela vazia. Este usuário é a evidência de que já existe demanda orgânica chegando antes da oferta.
2. **Este lead ainda é recuperável.** A conta está ativa (`deleted_at = null`) e há um token FCM válido registrado — ele é alcançável por push. Quando houver quadras na região dele, vale uma notificação. Ressalva: a região é justamente o que não se sabe (G2), o que ilustra o custo prático do gap.
3. **Investigar os 10 erros `400` no `discover`** — provável corrida no app entre permissão de localização e primeira chamada. Afeta a primeira impressão de todo usuário novo.

**Sobre o rastreio:**

4. Implementar **G1 + G2 + G3 juntos** — mesma região de código, mesmo deploy, e juntos transformam o log de "quem bateu na API" em "quem procurou o quê, onde, e achou quantos resultados".
5. **G7** é uma linha de configuração no nginx; fazer no próximo `deploy-prd.sh`.
6. **G8** (tabela de eventos) e **G9** (analytics) merecem decisão à parte, com implicação de privacidade.

---

## Anexo — Comandos usados

```sh
# Acesso
ssh -p 51765 root@api.ifute.com.br

# Localizar o usuário no banco
docker exec ifute-postgresdb-1 psql -U "$POSTGRES_USER_NAME" -d "$POSTGRES_DATABASE_NAME" \
  -c "select user_id, email, name, created_at, deleted_at from \"user\" where email ilike '%marcoshuf84%';"

# Caminhos dos logs
docker inspect --format "{{.LogPath}}" ifute-core-simple nginx_proxy

# Requisição de login na janela do created_at
grep "08/Aug/2026:13:2[0-9]" <nginx-json.log> | grep "login/google"

# Sessão completa do IP
grep '^{"log":"189.40.69.84 ' <nginx-json.log>

# Places em produção
docker exec ifute-postgresdb-1 psql -U "$POSTGRES_USER_NAME" -d "$POSTGRES_DATABASE_NAME" \
  -c "select p.place_id, p.name, l.lat, l.lon, l.city from place p left join place_location l on l.place_id = p.place_id;"

# Identificação do IP
whois 189.40.69.84
dig +short -x 189.40.69.84
```

# Mapa de demanda orgânica — onde existe acesso real ao app

**Documento vivo.** Sem data no nome: é atualizado conforme novos relatórios surgem em [`historico/`](historico/), não substituído. Cada linha da tabela é um ponto no mapa onde alguém abriu o iFute por vontade própria.

**Última atualização:** 16/08/2026 — varredura completa da retenção de logs + revisão de todos os relatórios históricos.

> ⚠️ **Contém dados pessoais** (localização aproximada, IPs, identificadores de conta). Uso interno; não publicar. As coordenadas vêm do log já arredondadas a ~1 km ([`roundCoordinateForLog`](../ifute-core-simple/src/shared/utils/helpers/geo.ts)), o que agrega demanda por região sem localizar ninguém.

---

## Por que este arquivo existe

**Os logs não guardam esse histórico.** O journald da VPS está travado no **teto de 250 MB**, não nos 28 dias de retenção que a configuração sugere: em 16/08/2026 a janela real era de **~6 dias** (entrada mais antiga: 10/08 20:51 BRT). O `ifute-jobber` sozinho responde por **41% dos bytes** do log do core — um `POST /webhook/internal/stripe` por minuto, 24h por dia — e é ele quem empurra os sinais reais para fora.

Consequência já observada: a coordenada `-28.28, -54.26` aparecia nos relatórios de 10, 12 e 13/08 e **não existe mais no log**. Se este arquivo não existisse, o sinal teria sumido.

Enquanto não houver tabela de eventos no Postgres (gap **G8** do [rastreio de 08/08](historico/2026-08-08-rastreio-usuario-prod.md)), **este markdown é a única memória durável de demanda que a iFute tem.**

---

## O mapa

Ordenado por força do sinal.

| # | Onde | Coordenada (~1 km) | Quando | Plataforma | Buscas | Resultado | Cadastrou? |
|---|---|---|---|---|---|---|---|
| 1 | **Rio de Janeiro/RJ** — Zona Sul | [`-22.96, -43.17`](https://www.google.com/maps?q=-22.96,-43.17) | 16/08/2026 | Android | **11** | todas vazias | ✅ **sim** — Rodrigo |
| 2 | **Maringá/PR** — ~7 km do centro | [`-23.45, -51.88`](https://www.google.com/maps?q=-23.45,-51.88) | 15/08/2026 | Android | 4 | todas vazias | ❌ não |
| 3 | **Norte de MG** — ~73 km NO de Montes Claros | [`-16.38, -44.44`](https://www.google.com/maps?q=-16.38,-44.44) | 13 **e** 14/08/2026 | Android | 0 (só abriu o app) | — | ❌ não |
| 4 | **Recife/PE** | [`-8.06, -34.87`](https://www.google.com/maps?q=-8.06,-34.87) | 13/08/2026 | iOS | 2 | todas vazias | ❌ não |
| 5 | **Desconhecido** — localização irrecuperável | — | 08/08/2026 | iOS | 3 | todas vazias | ✅ **sim** — Marcos |
| 6 | **Região de Santo Ângelo/RS** *(incerto)* | [`-28.28, -54.26`](https://www.google.com/maps?q=-28.28,-54.26) | ≤ 12/08/2026 | desconhecida | 1 requisição | — | ❌ não |

**Nenhum ponto fora do Brasil.** O único acesso estrangeiro já registrado (`39.86, 116.47`, Pequim) era scanner — ver "O que não entra" abaixo.

### Notas por ponto

1. **Rio de Janeiro** — o sinal mais forte do conjunto, e o único que converteu com localização conhecida. Sessão de 68s, 11 buscas, quatro delas repetidas de 3 em 3 segundos depois do cadastro: ele leu a tela vazia como erro de carregamento. Capital, ICP 1 e 2 do plano de vendas bem representados. Detalhe completo em [`2026-08-16-rastreio-usuario-prod.md`](historico/2026-08-16-rastreio-usuario-prod.md).
2. **Maringá** — sessão curta, buscou nas duas rotas (`discover` e `city`), viu vazio, saiu sem cadastrar.
3. **Norte de MG** — o único que **voltou num segundo dia**, o que é o melhor indicador de intenção da tabela. Mas nunca chegou a buscar: só abriu o app (`businessConfig` + `login/check`). Região de baixa densidade urbana.
4. **Recife** — sessão de 12 segundos, IP `200.133.64.130` (bloco RNP, distinto do IP do time). Buscou duas vezes, tentou entrar em área logada, desistiu.
5. **Marcos (08/08)** — anterior à instrumentação de `lat`/`lon` (task 30). Cadastrou-se, mas a região é **irrecuperável**: é o custo concreto do gap G2 ter sido fechado só em 09/08. Ver [`2026-08-08-rastreio-usuario-prod.md`](historico/2026-08-08-rastreio-usuario-prod.md).
6. **Santo Ângelo/RS** — uma única requisição, sem plataforma identificada, já fora do log. Pode ser usuário real ou ruído. **Não use como base de decisão**; está aqui para não se perder.

---

## A leitura que importa

**Existe demanda orgânica chegando sem nenhuma campanha ativa — e ela é geograficamente pulverizada.**

Os quatro pontos localizáveis estão a **800–2.000 km** uns dos outros: Rio, Maringá, norte de MG e Recife. Nenhum reforça nenhum outro. Isso é exatamente o cenário contra o qual o [plano de vendas](historico/2026-08-12-plano-vendas-donos-quadra.md) alerta — a regra é **saturar uma região** (10 a 15 locais num raio de 8–10 km) antes de investir em aquisição, porque um jogador que abre o app e vê uma quadra a 40 km desinstala.

Três consequências práticas:

- **A demanda espontânea não escolhe a região por você.** Ela chega dispersa demais para servir de critério único. O que ela prova é que o app é encontrável e que existe intenção real — não onde abrir.
- **Rio é o único desempate objetivo hoje.** É o único ponto com cadastro efetivo *e* localização conhecida, e é capital. Com n=1 isso não é conclusivo, mas é o único voto que existe.
- **100% das buscas deste mapa retornaram `places_in_radius: 0`.** Nenhuma é caso de falta de ativação (dono sem chave PIX); todas são **falta de oferta**. Enquanto produção tiver só as 4 Places de teste no Atlântico Sul, todo ponto novo desta tabela nasce vazio.

**A mudança de maior valor por esforço não é cadastrar quadra — é a tela vazia dizer que está vazia.** Um estado explícito (*"ainda não atendemos [cidade]. Quer ser avisado quando chegarmos?"*) transformaria cada linha desta tabela em um lead com consentimento e um voto de demanda registrado. Hoje, dos 6 pontos, **4 não deixaram sequer um e-mail**.

---

## O que não entra neste mapa

| Excluído | Por quê |
|---|---|
| `-54.44, -36.55` (Atlântico Sul) | Coordenada convencionada de **teste em produção** — ver [CLAUDE.md](../CLAUDE.md), "Testes em Produção". É o time validando fluxo, não usuário |
| `39.86, 116.47` (Pequim) | Scanner/bot. Apareceu nos relatórios de 10 a 13/08, nunca buscou nada |
| IP `189.7.228.9` | IP do time (dev/diretoria). Aparece em volume alto no backoffice e no director |
| Acessos sem `lat`/`lon` | Rotas que não recebem os headers de geolocalização. **Ausência aqui não é ausência de uso** |

---

## ⚠️ Este arquivo virou histórico

Desde a **task 32 (fases 2 e 3)**, o mapa de demanda é uma **tela**, não um markdown: `/dashboard/demand` no `ifute-master-backoffice` (`localhost:7104`), servida por `GET /director/private/reports/demand`. Ela mostra o mesmo que a tabela abaixo — buscas, buscas vazias, indicações e cadastros por região — só que sempre atualizada, com o funil de reservas junto, e sem depender de ninguém lembrar de editar.

**O que fazer com este arquivo:** mantenha-o pelos **pontos anteriores a 17/08/2026**, que a tabela `business_event` não tem e nunca terá — ela começou a gravar em 17/08 e os logs que os continham já rolaram. Em especial os pontos **5 e 6** (o cadastro de 08/08 sem localização e a região de Santo Ângelo), que só existem aqui.

Para pontos novos, **use a tela**. Não vale a pena manter duas verdades.

## Como atualizar (histórico — preferir a tela)

1. Gere o relatório da janela: `node scripts/analyze-prod-logins.mjs --since "7 days ago"` → grava em [`historico/`](historico/).
2. Olhe a **seção 5 (Localizações agregadas)** do relatório novo.
3. Para cada coordenada que **ainda não está** na tabela acima: confirme que não é teste, scanner ou IP do time, e adicione a linha.
4. Para uma coordenada que já existe, atualize `Quando` se houve retorno — **visita repetida é o sinal mais valioso da tabela** e merece nota.
5. Se o ponto merecer investigação individual (cadastrou, ou sessão longa), gere um `AAAA-MM-DD-rastreio-usuario-prod.md` em `historico/` e linke aqui.

> **Não apague linhas.** Um ponto que sumiu do log continua sendo um ponto que existiu — é justamente o que este arquivo preserva.

### Varredura completa (para reconstruir a tabela do zero)

```sh
ssh -p 51765 root@api.ifute.com.br \
  'journalctl CONTAINER_TAG=ifute-core-simple --since "30 days ago" -o cat --no-pager' \
  | grep '"event":"place_' \
  | python3 -c 'import sys, json, collections
c = collections.Counter()
for line in sys.stdin:
    try: d = json.loads(line)
    except ValueError: continue
    if d.get("lat") is not None: c[(d["lat"], d["lon"], d.get("eligible"))] += 1
for (lat, lon, elig), n in c.most_common(): print(f"{n:5d}  {lat},{lon}  eligible={elig}")'
```

⚠️ O `--since` do `journalctl` é interpretado em **horário local do servidor (BRT)**, enquanto o campo `time` das linhas do pino é **UTC**. E pedir 30 dias não traz 30 dias — traz o que couber nos 250 MB.

---

## Pendências que afetam este mapa

| # | O quê | Impacto aqui |
|---|---|---|
| ~~**G8**~~ | ~~Eventos de negócio em tabela no Postgres~~ | ✅ **Resolvido** na task 32 (17/08/2026). A tabela `business_event` grava busca, indicação, cadastro e reserva; a perda de sinal por rotação acabou daqui para frente |
| — | Reduzir o volume do jobber no log (41% dos bytes) | Multiplicaria a janela de retenção sem tocar em infra |
| **G2+** | `discover` e `city` são rotas **públicas** — não carregam `user_id` mesmo com o usuário logado | Dá para saber *de onde* veio a busca vazia, não *de quem*. Todo rastreio individual exige reconstruir a sessão por IP |
| — | Bug do `400` na primeira chamada de `discover` de todo cliente | Requisições que falham **não emitem** `place_search` — quem desistir nesse ~1 segundo fica invisível no mapa. **Segue aberto** |
| — | Tela vazia no app que consome `POST /place/suggestion` | O backend está pronto desde a task 32; sem a tela, o evento `place_suggestion` nunca é disparado e a coluna "Indicações" fica sempre zerada |

Detalhamento dos gaps em [`2026-08-08-rastreio-usuario-prod.md`](historico/2026-08-08-rastreio-usuario-prod.md) (seção 8) e do bug do `400` em [`2026-08-16-rastreio-usuario-prod.md`](historico/2026-08-16-rastreio-usuario-prod.md) (seção 5).

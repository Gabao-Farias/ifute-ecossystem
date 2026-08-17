# Plano de vendas — prospecção de donos de quadra

> Gerado em 12/08/2026. Documento comercial (não técnico). Complementa `tasks/task28.md` (engajamento da página de parceiros).

## 1. Diagnóstico: qual é o gargalo real

O produto está pronto (app, backoffice, pagamento, recorrência, saque PIX, afiliados). O que não existe é **mercado**: em 08/08/2026 produção tinha 4 Places, todas de teste no Atlântico Sul, e o `discover` retorna lista vazia para qualquer usuário real.

Isso cria o *cold start* clássico de marketplace: o dono de quadra não entra porque não há jogadores; o jogador não entra porque não há quadras.

**Decisão estratégica central:** não venda marketplace. Venda **ferramenta de gestão e cobrança**. O valor de "fim do caderninho + recebimento antecipado + sem no-show" é entregue no **primeiro dia, com o cliente que a quadra já tem**, e não depende de nenhuma rede. O marketplace é o upside que você entrega no mês 3.

Consequência prática: o gatilho de sucesso de cada cliente novo não é "quantos jogadores novos o iFute me trouxe", é "meus mensalistas e avulsos já reservam e pagam pelo app". Isso é 100% controlável.

### Erro que mata o projeto

Vender 1 quadra em Goiânia, 1 em São Paulo, 1 em Belo Horizonte. Sem densidade geográfica, o jogador abre o app, vê uma quadra a 40 km e desinstala.

**Regra:** escolha **uma** região (cidade média inteira ou 2-3 bairros vizinhos de capital) e sature. Meta de densidade mínima antes de investir em aquisição de jogadores: **10 a 15 locais num raio de 8-10 km.**

## 2. Perfil de cliente ideal (ICP)

### Priorizar (nesta ordem)

| Prioridade | Perfil | Por que |
|---|---|---|
| **1** | Arena de society/futebol 7, 2 a 4 quadras, gestão familiar, agenda por WhatsApp | Dor operacional máxima, decisão em uma conversa (o dono é quem atende o telefone), nenhum contrato com concorrente |
| **2** | Beach tennis / quadras de areia | Mercado em expansão, público jovem já paga por app, mix de aula + avulso, alta rotatividade de horários. Ressalva de **preço percebido** (não de margem): em reserva de 30 min a taxa de PIX pesa mais no total pro jogador — ver §3.1 |
| **3** | Poliesportivas privadas (futsal, vôlei) com horário morto de dia | Têm ociosidade clara de 8h às 17h |

### Desqualificar (não gaste tempo)

- Quadra pública / de prefeitura — não cobra, não tem PIX, não decide.
- Arena 100% lotada de mensalista fixo — sem dor de ocupação e o dono não quer mexer no que funciona. (Reabordar no mês 6 com o argumento de cobrança recorrente automática.)
- Redes grandes com ERP próprio — ciclo de venda longo, decisão em comitê. Fase 3.
- Condomínio/clube fechado — agenda não é comercial.

### Sinais de qualificação (checar antes de abordar)

- Instagram ativo com "reserve pelo direct" ou "chame no zap" na bio → **dor confirmada**.
- Horários vagos visíveis em dia de semana → dor de ocupação.
- Google Maps com avaliações reclamando de "marcaram e não estava reservado" → dor de duplo agendamento.
- Dono responde o próprio Instagram → ciclo de venda curto.

## 3. A proposta de valor, na ordem certa

Fale nesta sequência. Os três primeiros itens são os que vendem; os dois últimos são reforço.

1. **Fim do caderninho e do grupo de WhatsApp.** Agenda em tempo real, sem duplo agendamento, sem ficar conferindo comprovante de PIX no meio do jogo.
2. **Você recebe antes do jogo acontecer, e é dinheiro à vista.** O horário só é bloqueado quando o PIX cai. Fim do bolo e do "esqueci a grana, te pago semana que vem" — e sem esperar 30 dias de cartão. Ver §3.1: este é o argumento mais forte do arsenal.
3. **Custo zero pra você.** Sem mensalidade, sem taxa de adesão, sem contrato, sem exclusividade. A taxa da plataforma é paga pelo jogador. Se ninguém reservar, você não paga nada. **Este é o argumento que derruba a última objeção — guarde ele pro fechamento.**
4. **Mensalista com cobrança recorrente e lembrete automático.** O horário fixo semanal é gerado sozinho e o app cobra o jogador, sem você correr atrás de 12 pessoas. Atenção ao fraseado — ver §3.1: **não** prometa débito automático.
5. **(a partir do mês 3) Jogador novo.** Quando a região tiver densidade, seu horário morto entra na busca de quem procura quadra.

### Não diga (ainda)

- ~~"milhares de atletas"~~ — hoje é falso e queima sua credibilidade no primeiro follow-up quando o dono perguntar quantas reservas vieram de fora. Substitua por: *"Estamos abrindo a operação aqui em [região] agora. O que eu te garanto hoje é a agenda e o recebimento; a demanda nova vem conforme a região enche — e é por isso que quem entra agora entra sem custo e com prioridade."*
- ~~"cobrança automática do mensalista"~~ — sem cartão não há débito automático. Ver §3.1(a) para o fraseado correto.

## 3.1. Pagamento é 100% PIX — o que isso muda na venda

Produção opera **somente com PIX**. Cartão de crédito está desligado (flag `useCreditCardPayment = false`). Isso não é uma limitação a esconder: **é vantagem comercial em quase tudo**, com dois pontos de atenção que precisam de fraseado honesto.

### O que fica mais forte (use no pitch)

| Vantagem | Como falar em campo |
|---|---|
| **Dinheiro à vista, não D+30** | *"Você não espera 30 dias de cartão. O jogador paga o PIX hoje, vira saldo hoje, e você saca quando quiser."* Dono de arena vive de caixa semanal — paga diarista, luz, manutenção, grama. Essa é a diferença mais concreta que você tem contra qualquer sistema que repassa por cartão. |
| **Zero comportamento novo pro cliente** | *"Seu cliente já te paga por PIX hoje. Não muda nada pra ele — só que agora o horário fica garantido e você não precisa ficar conferindo comprovante."* Não há curva de aprendizado, não há "não tenho limite no cartão". |
| **Zero chargeback** | PIX não tem contestação. Não existe o cenário de o jogador jogar e depois pedir estorno na operadora. Elimina por completo um risco que o modelo de cartão traz (e que hoje nem é tratado após o settlement). |
| **Cobertura total do público** | Todo peladeiro de 18 a 40 anos tem PIX; nem todos têm cartão com limite livre pra travar R$ 200 de quadra. PIX-only **amplia** o público pagante, não reduz. |
| **Sem pedir dados de cartão** | Menos atrito e menos desconfiança no checkout. Ninguém precisa digitar 16 dígitos pra reservar futebol. |
| **Coerência com o QR code da quadra** | O jogador escaneia a placa, reserva e paga por QR. É o mesmo gesto do início ao fim — reforça a peça central do plano (§6). |

### Os dois pontos de atenção (e o fraseado correto)

**a) Não existe débito automático do mensalista.** Sem cartão tokenizado, a recorrência gera uma **nova cobrança PIX a cada ciclo** e o app lembra o jogador de pagar; ela não debita sozinha. Não venda "cobrança automática" — o dono vai cobrar isso de você no mês seguinte.

> Fraseado correto: *"O horário fixo do seu mensalista é gerado toda semana automaticamente e o app cobra ele por você, com lembrete. Você não precisa mais mandar mensagem individual — mas o pagamento é PIX, então quem confirma é ele."*

**b) O horário só fecha quando o PIX cai.** Diferente do cartão, não há autorização instantânea: o jogador gera o QR e pode não pagar. Isso significa reservas em `waiting_payment` que podem expirar. É honesto e até favorável, mas precisa ser dito na hora certa:

> *"Só é considerado reservado depois que o PIX entra. Se o cara gerar e não pagar, o horário volta a ficar livre pra outro — você nunca fica com quadra travada de graça."*

### Consequência: reserva longa fica mais barata para o jogador

**Todas as taxas são repassadas ao cliente final** — é a regra de precificação da plataforma, implementada em `calculateAsaasPixCostBreakdown`:

```
finalValue  = netValue + (R$ 4,99 × blocos) + R$ 1,99
              └─ do dono ─┘  └─ da iFute ─┘   └ do Asaas ┘
```

Duas consequências que **não** devem ser confundidas:

**a) A margem da plataforma é constante: R$ 4,99 por bloco, sempre.** O R$ 1,99 do PIX IN não sai da nossa taxa — ele é somado ao preço final e pago pelo jogador. Reserva de 30 min ou de 3 horas dá exatamente a mesma margem por bloco. Não existe "cliente de margem melhor" por duração.

**b) Quem ganha com reserva longa é o jogador.** O PIX IN é fixo **por cobrança**, então quanto mais blocos numa mesma reserva, mais diluído ele fica:

| Reserva | Taxa da plataforma | Taxa PIX | Total de taxas | PIX por bloco |
|---|---|---|---|---|
| 30 min (1 bloco) | R$ 4,99 | R$ 1,99 | R$ 6,98 | R$ 1,99 |
| 1 hora (2 blocos) | R$ 9,98 | R$ 1,99 | R$ 11,97 | R$ 1,00 |
| 2 horas (4 blocos) | R$ 19,96 | R$ 1,99 | R$ 21,95 | R$ 0,50 |
| 3 horas (6 blocos) | R$ 29,94 | R$ 1,99 | R$ 31,93 | R$ 0,33 |

Isso é **argumento de venda, não de margem** — e é um argumento bom, porque o que ele incentiva (reserva mais longa) é exatamente o que o dono quer (menos buraco de 30 min na agenda). Os interesses estão alinhados dos três lados.

> Frase pronta pro dono: *"Quanto mais tempo o cara fecha de uma vez, mais barato fica pra ele — a taxa do PIX é uma só por reserva. Duas horas de uma vez sai proporcionalmente mais em conta que duas reservas de uma hora."*

**Uma cobrança por reserva, nunca uma por bloco** — isso o sistema já faz certo (`platformCut = taxa × blocos` num único `finalValue`), e é preciso **manter**: se uma reserva de 2h virasse quatro cobranças de R$ 4,99, o jogador pagaria R$ 7,96 de taxa de PIX em vez de R$ 1,99. Quem sente a diferença é ele, não nós — mas é preço final visível, e preço final visível é conversão.

Do lado do saque, o PIX OUT custa R$ 2,00 e é descontado **de quem saca** — esse sim sai do bolso do dono. Oriente a **acumular e sacar uma vez por semana** em vez de sacar por reserva: *"Junta a semana e saca de uma vez, aí os R$ 2 do saque diluem no total."*

## 4. A objeção principal (e a resposta que funciona)

> "Meu cliente vai pagar R$ 4,99 a mais por meia hora? R$ 9,98 na hora cheia? Ele vai reclamar comigo."

Esta é **a** objeção. Três movimentos, nesta ordem:

**a) Divida pelo rachão.** Ninguém joga bola sozinho. Uma pelada de society racha entre 10 e 14 pessoas. Somando **todas** as taxas de uma hora reservada (R$ 9,98 de plataforma + R$ 1,99 de PIX = R$ 11,97):

> R$ 11,97 por hora ÷ 12 jogadores ≈ **R$ 1,00 por pessoa.**

Nunca fale "R$ 9,98" nem "R$ 11,97". Fale "**cerca de um real por jogador**". É o mesmo número, e é o número honesto do ponto de vista de quem paga — inclui o PIX, então não há surpresa depois.

**b) Enquadre como conveniência, não como taxa.** É o modelo do iFood e do Uber: quem quer resolver às 23h da noite pelo celular, com horário garantido e pago, paga por isso. Quem preferir continuar te chamando no WhatsApp e pagando PIX direto **continua fazendo isso** — o iFute não é exclusivo e você não precisa migrar nada.

**c) Compare com o custo do calote.** Uma desmarcada de última hora custa ao dono uma hora inteira de quadra. Se ele tem 2 furos por semana, a conta é imediata e maior que a taxa — que, aliás, não sai do bolso dele.

### Demais objeções

| Objeção | Resposta |
|---|---|
| "E se o cliente cancelar?" | Existe janela de cancelamento definida em regra. Fora da janela, o horário é seu. |
| **"Só PIX? Não tem cartão?"** | *"Só PIX — e é de propósito. É o que faz o dinheiro cair na hora em vez de 30 dias, e é como seu cliente já te paga hoje."* Se insistir: nenhum jogador reclama de pagar futebol por PIX; reclamam de travar limite do cartão. |
| **"E se ele quiser parcelar?"** | Ticket de pelada é rachado — ninguém parcela R$ 15. Para mensalista, o certo é cobrar **por semana**, não o mês fechado: fica leve pro jogador e previsível pro dono. |
| "Meu cliente é ruim de tecnologia" | Ele já usa PIX no banco. É o mesmo QR code de sempre. |
| "Já uso [outro sistema]" | Não precisa trocar. Cadastre só os horários que hoje ficam vagos e compare em 30 dias. Custo zero pra testar. |
| "Não quero cadastrar chave PIX pra ninguém" | O saque é sob demanda, pra sua chave, você decide quando. Nada de fechamento de mês. |
| "Tenho que aprender sistema novo?" | Login com Google, sem senha. **E eu cadastro tudo pra você agora, aqui.** (ver §6) |
| "Vou pensar" | "Fechado. Só uma coisa: posso cadastrar seu local agora, sem publicar? Aí semana que vem você olha a agenda pronta e decide." — reduz a decisão a zero risco. |

## 5. Canais de prospecção, por ROI

| # | Canal | Custo | Quando usar |
|---|---|---|---|
| 1 | **Presencial na arena** | Tempo | Fase 0 e 1. Melhor conversão de longe. Vá **terça a quinta, 14h-17h** — quadra vazia, dono disponível. Nunca 19h-22h (pico, ele vai te dispensar). |
| 2 | **Instagram DM → WhatsApp** | Zero | Volume. Quase toda arena tem IG. Mapeie via Google Maps + hashtags da cidade. |
| 3 | **Organizadores de pelada (lado da demanda)** | Zero | Alavanca invertida: convença o organizador do rachão e ele pressiona a quadra ("só jogo se der pra reservar pelo app"). Um organizador vale mais que um flyer. |
| 4 | **Afiliados / padrinhos** | R$ 0,99/bloco (variável) | Fase 2 — é o único canal que escala sem você. Ver §7. |
| 5 | **Ligas e campeonatos amadores** | Baixo | Um organizador de liga aluga dezenas de horas/mês. Venda por volume. |
| 6 | Google Meu Negócio / SEO local | Tempo | Depois da densidade, pro lado jogador. |

### Como montar a lista (2 horas de trabalho)

1. Google Maps: buscar por `society`, `futebol 7`, `arena`, `quadra de areia`, `beach tennis`, `poliesportiva` + nome da região. Exportar nome, endereço, telefone, nota.
2. Instagram: seguir cada uma, salvar o @ e o nome de quem responde.
3. Planilha com colunas: `local | @ | telefone | quadras | fonte | status | próximo passo | data`.
4. Meta: **100 locais mapeados** antes de fazer a primeira abordagem.

### Funil esperado (venda de campo, ICP 1)

```
100 mapeados → 60 alcançados → 25 conversas reais → 10 demos → 5 cadastrados → 3 ativados
```

Ativado = tem ao menos **uma reserva paga**. Cadastro sem reserva não conta como cliente.

## 6. O manual de execução: onboarding concierge

Nas primeiras 15 vendas, **não** mande o dono se cadastrar sozinho. O self-service existe pra escalar depois; agora ele é o maior ponto de perda.

Roteiro da visita (25-40 min):

1. Peça pra ver a agenda dele. Deixe ele reclamar. Anote a dor com as palavras dele.
2. Abra o backoffice **no seu notebook**, login com o Google **dele**.
3. Cadastre com ele: local, fotos (tire na hora com o celular), quadras, preço por bloco, horário de funcionamento.
4. Cadastre a chave PIX.
5. Abra o app no seu celular e **faça uma reserva de verdade** de R$ 1 num horário dele: gere o PIX, pague ali na frente dele e mostre a reserva caindo no painel com o saldo aparecendo. São 40 segundos e vale mais que qualquer apresentação — é a prova de que o dinheiro chega na hora.
6. Cole o **QR code impresso** na portaria/grade da quadra.
7. Combine o retorno: "te chamo quinta pra ver a primeira reserva de cliente seu".

### O QR code é a peça mais importante do plano

Ele resolve o cold start: converte o jogador **que já está na quadra** em usuário do app, gerando reserva **para aquele mesmo dono**. O dono vê valor na primeira semana sem depender de nenhuma rede, e cada local vira uma pequena fábrica de usuários do app.

Material a produzir (barato, gráfica local): placa A4 rígida + adesivo de balcão, com "**Reserve seu horário pelo app**" + QR code + o verde da marca (`#32E75F`).

## 7. O motor que escala: transformar cliente em vendedor

O programa de afiliados já está construído: 20% da taxa da plataforma, R$ 0,99 por bloco, vínculo sem prazo, saldo e chave PIX próprios, saque sob demanda. Isso é uma força de vendas com **custo variável zero até a venda acontecer** — e hoje está subutilizada.

Ações:

1. **Não espere o dono descobrir o programa.** Peça a indicação na conversa de ativação (quando ele acabou de ver a primeira reserva cair — é o pico de boa vontade): *"Você conhece outro dono de arena aqui na região? Você ganha R$ 0,99 por hora reservada na quadra dele, pra sempre."*
2. **Recrute padrinhos que não são donos de quadra.** Esse é o insight de canal mais valioso do plano — existem pessoas que já falam com *todos* os donos de quadra da cidade:
   - **instaladores/vendedores de grama sintética** — conhecem cada arena da região e vão voltar lá pra manutenção;
   - **árbitros e organizadores de liga amadora**;
   - **fornecedores de bola, uniforme, iluminação, redes**;
   - **fotógrafos e social media de arena esportiva**.
   Para eles, R$ 0,99/bloco recorrente sobre a carteira inteira é renda passiva relevante e o custo de venda é zero.
3. **Meta de fase 2:** 30% dos locais ativos com ao menos 1 indicado.

## 8. Metas e cronograma (90 dias)

| Fase | Semanas | Objetivo | Meta |
|---|---|---|---|
| **0 — Faróis** | 1-2 | Provar o produto em campo com onboarding concierge | 5 locais, ~15 quadras, **3 ativados**, 1 região só |
| **1 — Densidade** | 3-6 | Saturar a região-alvo | 15 locais ativados no raio de 10 km; primeiro jogador orgânico via QR code |
| **2 — Motor** | 7-12 | Ligar afiliados e aquisição de jogador | 30 locais; 30% dos donos com ≥1 indicado; começar mídia local pro lado jogador |

### Dimensionamento de receita (aritmética, não previsão)

Preencha com dados reais assim que tiver os primeiros faróis:

```
receita bruta/mês de um local = blocos reservados no app por mês × R$ 4,99
```

Exemplo hipotético para calibrar meta — arena de 3 quadras com 20 horas/semana passando pelo app, reservas de 1 hora:

| Linha | Cálculo | Valor |
|---|---|---|
| Blocos/mês | 20 h × 2 blocos × 4,33 semanas | ~173 blocos |
| **Receita da plataforma** | 173 × R$ 4,99 | **R$ 863/mês por local** |
| Custo de PIX IN | pago pelo jogador (gross-up) | R$ 0 |
| Se o local tiver padrinho | 173 × R$ 0,99 | −R$ 171 → **~R$ 692** |

Dez locais nesse patamar ≈ **R$ 8,6 mil/mês** (ou ~R$ 6,9 mil se todos vierem de indicação). O único custo variável que sai da nossa receita é a **comissão de afiliação** — o PIX IN é repassado ao jogador (§3.1). Isso simplifica o modelo: a receita é linear em blocos reservados, e a única alavanca de custo é quantos locais vieram por indicação. Demais custos (VPS, domínio, Apple Developer) são fixos e estão no README; detalhamento na documentação da task 29.

Use esse número para decidir quanto vale investir por cliente adquirido.

## 9. KPIs — o que medir semanalmente

**Métrica-mãe da fase 0/1: locais _ativados_ na região-alvo.** Não cadastros. Cadastro sem reserva é vaidade.

| KPI | Por quê |
|---|---|
| Locais ativados (≥1 reserva paga) | A única prova de valor |
| Taxa de ativação (cadastrou → 1ª reserva) | Mede se o onboarding funciona |
| Tempo até a primeira reserva | Se passar de 7 dias, o cliente esfria |
| Blocos reservados/semana por local | Mede profundidade, não largura |
| **Blocos por cobrança (duração média)** | Não afeta margem (§3.1) — afeta o preço que o jogador vê: 30 min carrega R$ 1,99 de PIX num só bloco, 2h dilui em quatro. Watch item de conversão |
| **Taxa de conversão do PIX (gerado → pago)** | Risco exclusivo do PIX-only. Se cair, o problema é expiração ou lembrete, não venda |
| Locais com ≥1 reserva nos últimos 14 dias (retenção) | Detecta churn silencioso |
| GMV e taxa bruta | Receita |
| % de donos com ≥1 indicado | Saúde do motor de afiliados |
| Instalações do app por local (QR code) | Mede se o QR está funcionando |

## 10. O que falta construir para vender melhor

Itens de produto/marketing que hoje travam ou enfraquecem a venda:

- [ ] **Corrigir a promessa da `/business`** — trocar "milhares de atletas" por prova de operação (agenda, recebimento, zero custo). Prioridade alta: é a primeira coisa que o prospect lê.
- [ ] **Deixar o PIX-only explícito e vendido como vantagem** na `/business` e na FAQ (`businessFaq`): "dinheiro à vista, sem D+30, sem chargeback". Hoje a página fala de saque via PIX mas não diz que o recebimento também é só PIX — o dono descobre depois, e descobrir depois parece limitação escondida.
- [ ] **Fechar as brechas de cartão no código** (decisão de produto, ver §10.1): fallback do `RemoteConfigContext` ainda é `useCreditCardPayment: true`; o `createAuthorizedPayment` do Asaas cai em `credit-card` quando `paymentMethod` não vem.
- [ ] **Taxa de conversão do PIX no master-backoffice** — quantas cobranças geradas viram pagas, e em quanto tempo. É o KPI que o PIX-only cria e hoje não é medido.
- [ ] **Reserva mínima de 1 hora configurável por local** — agenda do dono mais limpa e taxa de PIX diluída pro jogador (§3.1). Não muda a margem da plataforma.
- [ ] **Definir quem paga o PIX OUT do estorno** — cancelamento dentro da janela devolve dinheiro, e a devolução custa R$ 2,00. Precisa estar escrito antes de acontecer com um cliente.
- [ ] **Captura de lead na landing** — hoje todos os CTAs jogam direto no backoffice. Quem não converte na hora está sendo perdido sem rastro. Precisa de formulário "quero falar com o time" (nome, WhatsApp, cidade, nº de quadras) alimentando uma planilha/CRM simples.
- [ ] **Simulador de receita para o DONO** — hoje o simulador existe só para o padrinho (`/dashboard/affiliates` e `/partners`, task 28). Falta o inverso: "quanto você deixa de faturar com horário vago e no-show". É a melhor peça de venda que a landing poderia ter.
- [ ] **QR code / material impresso por local** — gerar no backoffice um PDF pronto pra imprimir, com o link do local.
- [ ] **Funil de onboarding no master-backoffice (task 23)** — hoje não há como ver quantos donos começaram o cadastro e pararam no meio, nem em que passo. Sem isso a taxa de ativação é chute.
- [ ] **Isenção temporária de taxa** — poder zerar a taxa da plataforma nas primeiras N reservas de um local novo remove a objeção de preço na fase de prova. Requer suporte no backend (cupom/isenção por local) — hoje não existe.
- [ ] **One-pager impresso** (A4, frente e verso) derivado da `/business`, pra deixar com quem disse "vou pensar".
- [ ] **Política de cancelamento em linguagem de dono** — uma página curta que responde "e se o cliente desmarcar?" sem juridiquês.

## 10.1. Decisões pendentes sobre o PIX-only

Levantamento do código em 12/08/2026: **produção já é PIX-only na prática**, mas o estado não é uniforme. Três pontos precisam de decisão explícita antes de a operação comercial começar — não são bugs de venda, são inconsistências que podem virar suporte na hora errada.

| Onde | Situação | Decisão a tomar |
|---|---|---|
| `ifute/src/services/remoteConfig.ts` | `useCreditCardPayment` default `false` ✅ (o comentário logo acima ainda diz "both payment methods stay enabled" — está defasado) | Confirmar que o valor **no console do Firebase** também é `false`. O default local só vale se o fetch falhar. |
| `ifute/src/contexts/RemoteConfigContext.tsx` | `DEFAULT_FLAGS` ainda tem `useCreditCardPayment: true` | Alinhar para `false`. Hoje existe uma janela entre o boot e o `fetchAndActivate` em que a tela de pagamento pode oferecer cartão. |
| `ifute-core-simple` — `AsaasProvider.createAuthorizedPayment` | Cai em `credit-card` quando `paymentMethod` não é informado; a recorrência tem branch de `creditCardToken` (legado das tasks 3/6) | Decidir entre (a) inverter o default para `pix` e manter o caminho de cartão adormecido, ou (b) removê-lo. Recomendo (a): reversível, e não mexe na recorrência agora. |

Enquanto (a) não for feito, todo caller novo deve passar `paymentMethod: "pix"` explicitamente. `CLAUDE.md` e `README.md` já foram atualizados para refletir o PIX-only.

## 11. Scripts prontos

### Instagram DM (primeiro contato — curto, sem link)

> Fala, [nome]! Tudo certo? Vi que as reservas da [arena] são pelo direct/zap.
> Eu sou o Gabriel, do iFute — a gente coloca a agenda da quadra no app: o jogador escolhe o horário e **paga por PIX antes de jogar**. Cai como saldo na hora e você saca quando quiser, sem esperar 30 dias de cartão.
> Sem mensalidade e sem contrato — a taxa é paga pelo jogador, não por você.
> Posso passar aí terça ou quarta à tarde pra te mostrar em 15 min? Deixo tudo cadastrado, se você gostar.

*Por que funciona: nomeia a dor observada, entrega o benefício em uma linha, mata o custo, e pede um compromisso pequeno com duas opções de data.*

### WhatsApp (follow-up de quem não respondeu — 3 dias depois)

> [nome], só pra não te deixar sem resposta: o que eu queria te mostrar leva 15 min e não te custa nada testar.
> Se agora não for o momento, me diz que eu te procuro em 30 dias. Se quiser dar uma olhada antes: ifute.com.br/business

### Abertura presencial (30 segundos na porta da arena)

> Boa tarde! O [dono] tá por aí? … Sou o Gabriel, do iFute.
> Rapidinho: hoje as reservas daqui são no WhatsApp, né? Como vocês fazem quando o cara marca e não aparece?
> *(deixa ele falar — a dor sai daqui)*
> É exatamente isso que a gente resolve: o horário só fica preso quando o PIX cai. Te mostro em 10 min no computador e, se fizer sentido, já deixo tudo cadastrado hoje. Sem mensalidade e sem contrato.

*Por que funciona: pergunta em vez de pitch. Quem responde "ah, sempre tem um que dá bolo" já se vendeu sozinho.*

### Pedido de indicação (na conversa de ativação)

> Massa, então já entrou a primeira reserva. Deixa eu te fazer uma pergunta:
> você conhece outro dono de arena aqui na região?
> Todo mundo aqui tem um link de indicação. Se ele se cadastrar pelo seu link, você ganha **R$ 0,99 por hora reservada na quadra dele, todo mês, sem prazo de validade** — e cai num saldo separado, com sua chave PIX.
> Te manda o link agora?

### Reabordagem de "já uso outro sistema"

> Tranquilo, nem precisa trocar. Faz assim: cadastra só os horários que hoje ficam vagos — quarta à tarde, domingo de manhã.
> Não tem mensalidade, então o pior cenário é ficar igual. Em 30 dias você olha quanto entrou por ali e decide.

## 12. Semana 1, dia a dia

| Dia | Tarefa |
|---|---|
| **Seg** | Escolher a região-alvo. Mapear 100 locais no Google Maps + Instagram na planilha. |
| **Ter** | Mandar 30 DMs. Visitar presencialmente as 5 arenas mais próximas, 14h-17h. |
| **Qua** | Encomendar 20 placas de QR code na gráfica. Mandar 30 DMs. Visitar 5 arenas. |
| **Qui** | Onboarding concierge completo nos que disseram sim (meta: 2). Follow-up dos DMs sem resposta. |
| **Sex** | Visitar 5 arenas. Corrigir o texto da `/business`. Revisar o funil na planilha. |
| **Sáb** | Ir a uma arena movimentada de manhã: falar com **organizadores de pelada**, não com o dono. Colher 10 contatos. |

Ao fim da semana você deve ter: 100 leads mapeados, ~60 abordados, 2-3 locais cadastrados e ao menos 1 reserva paga de verdade em produção.

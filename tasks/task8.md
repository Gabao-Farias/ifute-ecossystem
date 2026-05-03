Segue abaixo troca de emails realizada com pessoal do Asaas...

=================

Dúvidas sobre automação de refunds/transferências e enquadramento fiscal de marketplace
Caixa de entrada

Gabriel Taborda Farias <gabrielfariasbass@gmail.com>
ter., 28 de abr., 22:50 (há 2 dias)
para integracoes

Olá, equipe do Asaas,

Estou entrando em contato pois estamos estruturando uma plataforma de intermediação de serviços (modelo marketplace) e pretendemos utilizar o Asaas como principal meio de processamento financeiro. Durante nossos testes, surgiram algumas dúvidas importantes relacionadas à automação e ao enquadramento contábil/fiscal do modelo.

1. Automação de refunds e transferências (SMS / 2FA)
Nos testes realizados (principalmente em ambiente sandbox), observamos que operações como estornos (refunds) e transferências podem exigir validação via código SMS.
Nosso objetivo é operar esses fluxos de forma totalmente automatizada via API (sem intervenção manual).

Diante disso, gostaríamos de entender:

Em ambiente de produção, chamadas via API para refunds e transferências exigem autenticação por SMS a cada operação?
Existe alguma configuração, liberação ou ajuste de conta que permita executar essas operações de forma totalmente automatizada (sem validação manual)?
Há limites ou condições (volume, valor, risco, KYC, etc.) que influenciam esse comportamento?
2. Modelo de intermediação (marketplace) e implicações fiscais/contábeis
Nosso modelo consiste em intermediar pagamentos entre clientes finais e fornecedores (parceiros), onde:

o cliente paga através da nossa conta no Asaas,
o valor é retido temporariamente,
posteriormente é repassado ao parceiro, descontando nossa comissão.
Nesse contexto, gostaríamos de esclarecer:

Todo o volume financeiro que transita pela conta é considerado como faturamento da nossa empresa?
Existe alguma forma suportada pelo Asaas (ex: subcontas, split, relatórios específicos, etc.) que ajude a caracterizar corretamente que parte desses valores pertence aos parceiros?
Há recomendações oficiais do Asaas para operação nesse modelo visando conformidade fiscal no Brasil?
Nosso objetivo é estruturar a operação de forma correta desde o início, tanto do ponto de vista técnico quanto fiscal.

Agradecemos desde já pela atenção e ficamos à disposição para fornecer mais detalhes sobre o projeto, caso necessário.

Atenciosamente,
Gabriel Farias

2

Helen (Asaas) <suporteintegracoes.zendesk@asaas.com.br>
qua., 29 de abr., 15:24 (há 20 horas)
para mim

Olá Gabriel, tudo joia?
 
Meu nome é Helen, faço parte do time de integrações do Asaas, e estarei dando continuidade ao seu atendimento. 😊
 
Respondendo aos questionamentos:
1. Automação de refunds e transferências (SMS / 2FA)
Em ambiente de produção, chamadas via API para refunds e transferências exigem autenticação por SMS a cada operação?
Sim, confirmamos: toda transferência realizada no Asaas precisa ser aprovada via token SMS ou token APP. Esse é o mecanismo de ações críticas, criado para proteger as transações.
 
Existe alguma configuração que permita executar essas operações de forma totalmente automatizada?
Sim, há dois mecanismos disponíveis:
🔒 Opção 1: IPs fixos
Fixar IPs na conta garante que apenas essas origens acessem a API — porém não elimina a necessidade do token SMS/APP. O token continua obrigatório.
 
🔁 Opção 2: Webhook de autenticação
Esta é a única forma de dispensar o token SMS/APP. Ao habilitar e configurar o mecanismo de validação via Webhook, as autorizações por token são automaticamente desativadas.
Para isso, é necessário, conforme nossa documentação: https://docs.asaas.com/docs/mecanismo-para-validacao-de-saque-via-webhooks. Para que o token deixe de ser exigido, é preciso:
Ativar o Webhook de autenticação na sua conta;
Configurar corretamente o mecanismo de validação no seu sistema (o Asaas fará validações via esse Webhook);
Ter o mecanismo aprovado/operacional — uma vez que o Webhook esteja configurado e validado, as autorizações por token serão automaticamente desativadas.
Temos esse vídeo: https://youtu.be/vXKIU4oOAa0?si=Ob_dn5PeqoUN8upk&t=38, que explica a parte de transferências 😉
 
Há limites ou condições (volume, valor, risco, KYC etc.) que influenciam esse comportamento?
As contas e subcontas possuem limites de valor nas transferências. Caso esse limite seja atingido, é possível solicitar ajuste diretamente ao suporte do Asaas.
 
 
2. Modelo de intermediação (marketplace) e implicações fiscais/contábeis
Todo o volume financeiro que transita pela conta é considerado como faturamento da empresa?
Do ponto de vista operacional, o Asaas registra os valores recebidos na conta onde a cobrança é gerada. No entanto, a classificação fiscal e contábil desses valores, se constituem faturamento da sua empresa, depende da estrutura jurídica do seu modelo de negócio. Recomendamos validar essa questão com seu contador, considerando o modelo específico de intermediação da sua empresa.
 
Existe alguma forma suportada pelo Asaas que ajude a caracterizar que parte dos valores pertence aos parceiros?
Sim! O Asaas suporta o modelo de split de pagamentos via subcontas, que permite separar operacionalmente os valores. O fluxo funciona assim:
➝ Crie subcontas para cada parceiro/fornecedor, cada subconta terá seu próprio walletId
➝ Gere a cobrança na conta principal (ou em uma subconta)
➝ Configure o split: defina um percentual ou valor fixo para cada destino
➝ Ao receber o pagamento, o Asaas distribui automaticamente: desconta as taxas da conta que gerou a cobrança e repassa os valores configurados
Também é possível fazer split para contas Asaas de terceiros (não subcontas suas), desde que o proprietário informe o walletId.
 
Há recomendações oficiais do Asaas para operação nesse modelo visando conformidade fiscal?
Do ponto de vista da plataforma, a conta que gera a cobrança é a responsável fiscal pela operação. O split de pagamentos organiza o fluxo financeiro entre as partes, mas não substitui a orientação contábil e jurídica. Para garantir conformidade fiscal no seu modelo de marketplace, o ideial é validar com seu contador qual estrutura (conta principal, subcontas, notas fiscais etc.) é mais adequada para a sua operação.
 
 
Qualquer dúvida, fico à disposição, ótima tarde!!

=================

Visto isso, precisamos fazer a implementacao da 🔁 Opção 2: Webhook de autenticação para nao precisar ter chamadas sms para ficar autorizando as transacoes e tambem os refunds.

Qualquer duvida acerca da questão só perguntar!

=================

## RESOLVIDO

Implementação do webhook de autorização do Asaas em `ifute-core-simple/`:

- Endpoint novo: `POST /webhook/payment/asaas/auth`
- Token dedicado: `ASAAS_AUTH_WEBHOOK_TOKEN` (separado do token do webhook de eventos)
- Tabela `provider_auth_decision_log` para idempotência entre as 3 retries do Asaas
- Política de decisão: aprova só transferências/refunds que casem com ordens nossas; recusa qualquer outra coisa
- Documentação: `ifute-core-simple/CLAUDE.md` (seção "Webhook de autorização do Asaas") e `.env.sample`

**TODO operacional (fora do código):**
1. Gerar `ASAAS_AUTH_WEBHOOK_TOKEN` (`require('crypto').randomBytes(64).toString('hex')`) e adicionar ao `.env` de cada ambiente
2. No painel Asaas → **Conta Asaas → Integrações → Mecanismos de Segurança**:
   - Colar a URL `https://api.ifute.com.br/webhook/payment/asaas/auth`
   - Colar o token gerado
   - **Ativar** o toggle "Ativar autorização de saque para estornos Pix"

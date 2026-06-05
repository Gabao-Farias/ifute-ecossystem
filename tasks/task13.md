Temos um problema.

O Asaas está cobrando para enviar mensagens que não queremos na hora da cobrança...

Precisamos desabilitar esta opção para toda a nossa base de usuários.

E certificar de que os novos clientes quando forem criados não tenham esta opção habilitada para não gerar esta taxa

Objetivos:

Buscar todos os nosso clientes que já tem conta criada no Asaas.
Atualizar todos os clientes definindo:
{
  "notificationDisabled": true
}
Opcionalmente:
Buscar as notificações já existentes de cada cliente.
Desativar todas individualmente.
Também demonstrar atualização em lote.

Requisitos técnicos:

Utilizar Node.js 20+
Usar JavaScript puro (sem TypeScript)
Utilizar axios ou fetch
Código resiliente:
retry
tratamento de rate limit
tratamento de erros
logs claros
paginação completa
Estrutura organizada
Variáveis de ambiente (.env)
Suporte sandbox e produção
Concorrência controlada para evitar bloqueios
Dry-run opcional
Mostrar progresso da migração
Não utilizar SDK oficial

Quero:

Estrutura completa do projeto
package.json
exemplo .env
script pronto para executar
explicação das rotas utilizadas
exemplos de respostas da API
melhores práticas
estratégia segura para executar em produção com milhares de clientes

Rotas/documentação relevantes do Asaas:

Portal principal:
https://docs.asaas.com/

Visão geral notificações:
https://docs.asaas.com/docs/notifications-overview

FAQ notificações:
https://docs.asaas.com/docs/notifications-1

FAQ PT-BR:
https://docs.asaas.com/docs/duvidas-frequentes-notificacoes

Introdução notificações:
https://docs.asaas.com/docs/notificacoes

Alterar notificações de cliente:
https://docs.asaas.com/docs/alterando-notificacoes-de-um-cliente

Recuperar notificações de cliente:
https://docs.asaas.com/reference/recuperar-notificacoes-de-um-cliente

Atualizar notificações em lote:
https://docs.asaas.com/reference/update-existing-notifications-in-batch

Artigo sobre taxas e desativação:
https://central.ajuda.asaas.com/hc/pt-br/articles/31998232571803-Como-desativar-o-envio-de-notifica%C3%A7%C3%B5es-de-cobran%C3%A7as

Importante:

Cobranças já criadas podem continuar gerando custos porque notificações são agendadas na criação da cobrança.
Quero minimizar totalmente custos futuros.
Quero garantir que novos clientes já sejam criados com:
{
  "notificationDisabled": true
}

Também inclua:

Estratégia incremental segura
Logs de auditoria
Como reverter
Como validar se tudo foi realmente desativado
Como evitar atingir limites da API
Como executar isso via cron/job recorrente

Além disso, gere:

Script principal
Serviço Asaas
Configuração HTTP reutilizável
Utilitário de retry/backoff
README.md detalhado
Exemplos curl
Sugestões de monitoramento


Se ficar alguma dúvida ou quiser confirmar algo, só perguntar

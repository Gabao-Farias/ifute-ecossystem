No back atualmente está ocorrendo o seguinte problema...

[2026-04-25 09:47:39.101 -0300] INFO: Incoming request
    ip: "::ffff:192.168.1.126"
    path: "/mobile/private/payment/order/confirm"
PaymentProviderError: Asaas POST /payments failed (status 400)
    at AsaasHttpClient.normalizeError (/Users/gabao/repos/ifute-ecossystem/ifute-core-simple/src/shared/services/payment/providers/asaas/client.ts:68:14)
    at AsaasHttpClient.request (/Users/gabao/repos/ifute-ecossystem/ifute-core-simple/src/shared/services/payment/providers/asaas/client.ts:53:18)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async AsaasProvider.createAuthorizedPayment (/Users/gabao/repos/ifute-ecossystem/ifute-core-simple/src/shared/services/payment/providers/asaas/AsaasProvider.ts:175:22)
    at async confirmPaymentOrder (/Users/gabao/repos/ifute-ecossystem/ifute-core-simple/src/apps/mobile/services/payment.service.ts:280:23) {
  code: 'provider_api_error',
  providerKey: 'asaas',
  cause: {
    status: 400,
    data: { errors: [Array] },
    originalMessage: 'Request failed with status code 400'
  }
}
{"name":"PaymentProviderError","code":"provider_api_error","providerKey":"asaas","cause":{"status":400,"data":{"errors":[{"code":"invalid_action","description":"Não é permitido split para sua própria carteira."}]},"originalMessage":"Request failed with status code 400"}}
Error: Erro ao processar pagamento, tente novamente.
    at confirmPaymentOrder (/Users/gabao/repos/ifute-ecossystem/ifute-core-simple/src/apps/mobile/services/payment.service.ts:323:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
[2026-04-25 09:47:39.796 -0300] ERROR: Asaas createAuthorizedPayment failed
    providerKey: "asaas"
    status: 400
    errors: [
      {
        "code": "invalid_action",
        "description": "Não é permitido split para sua própria carteira."
      }
    ]
[2026-04-25 09:47:39.796 -0300] ERROR: Erro ao processar pagamento, tente novamente.
    httpCode: 500
    errorId: "91e7c5d4-3b2a-4f8e-b63a-7d1f2e5c9a09"

Se entendi corretamente está sendo usado o mesmo ID de conta para fazer o split onde na verdade deveríamos ter o split de pagamento com ids:

* 1 ID da plataforma geral
* 1 ID específico do administrador que possuí o local agendado requerido

Verifique no código se existe tal lógica nos splits e faça um planejamento para entender o que seria necessário para operarmos desta forma, se precisaria nova tabela para declarar o ID geral da plataforma ou mais recursos...

No backend isso pode entrar como uma PR nova a partir de feature/payment-provider-migration
 já que a alteração é do mesmo contexto.

Qualquer dúvida que seja necessário para alinhamento, é só perguntar.

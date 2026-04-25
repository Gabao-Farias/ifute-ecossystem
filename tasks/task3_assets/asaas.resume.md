**Fluxo técnico completo (pensado pra Node/TypeScript)** + **endpoints da API do Asaas** + links de referência para você consultar.

---

# 🧠 Visão geral do fluxo

Como o Asaas **não tem auth/capture**, o fluxo correto é:

```
Criar cobrança → Cliente paga → Confirmar via webhook → 
(uso do serviço) → Cancelamento? → Estorno (refund)
```

---

# 🔌 1. Criar cobrança (cartão)

### Endpoint

```
POST /v3/payments
```

### Exemplo payload

```json
{
  "customer": "cus_123",
  "billingType": "CREDIT_CARD",
  "value": 100.00,
  "dueDate": "2026-04-25",
  "description": "Reserva quadra",
  "creditCard": {
    "holderName": "Nome",
    "number": "4111111111111111",
    "expiryMonth": "12",
    "expiryYear": "2028",
    "ccv": "123"
  },
  "creditCardHolderInfo": {
    "name": "Nome",
    "email": "email@email.com",
    "cpfCnpj": "12345678900",
    "postalCode": "99000000",
    "addressNumber": "123"
  }
}
```

📘 Docs:
[https://docs.asaas.com/reference/criar-nova-cobranca](https://docs.asaas.com/reference/criar-nova-cobranca)

---

# 📡 2. Confirmar pagamento (WEBHOOK)

👉 **ESSENCIAL — nunca confie só na resposta do create**

### Evento importante

* `PAYMENT_CONFIRMED`

### Endpoint que você cria

```
POST /webhooks/asaas
```

### Exemplo payload recebido

```json
{
  "event": "PAYMENT_CONFIRMED",
  "payment": {
    "id": "pay_123",
    "status": "CONFIRMED",
    "value": 100.00
  }
}
```

👉 Ação no backend:

```ts
if (event === "PAYMENT_CONFIRMED") {
  // marcar reserva como CONFIRMADA
}
```

📘 Docs:
[https://docs.asaas.com/docs/webhooks](https://docs.asaas.com/docs/webhooks)

---

# ❌ 3. Cancelar cobrança (antes de pagar)

### Endpoint

```
DELETE /v3/payments/{id}
```

👉 Use quando:

* cliente desistiu antes de pagar

📘 Docs:
[https://docs.asaas.com/reference/remover-cobranca](https://docs.asaas.com/reference/remover-cobranca)

---

# 💸 4. Estornar cobrança (refund)

### Endpoint

```
POST /v3/payments/{id}/refund
```

### Exemplo payload

```json
{
  "value": 100.00
}
```

👉 Pode ser:

* total
* parcial

📘 Docs:
[https://docs.asaas.com/reference/estornar-cobranca](https://docs.asaas.com/reference/estornar-cobranca)

---

# 🔁 5. Cancelar assinatura (recorrência)

### Endpoint

```
DELETE /v3/subscriptions/{id}
```

📘 Docs:
[https://docs.asaas.com/reference/remover-assinatura](https://docs.asaas.com/reference/remover-assinatura)

---

# 🧩 Modelo de estados (recomendado)

No seu sistema:

```ts
type PaymentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "REFUNDED";
```

Mapeamento com Asaas:

| Asaas     | Seu sistema |
| --------- | ----------- |
| PENDING   | PENDING     |
| CONFIRMED | CONFIRMED   |
| RECEIVED  | CONFIRMED   |
| REFUNDED  | REFUNDED    |
| DELETED   | CANCELLED   |

---

# ⚙️ Fluxo completo (pseudo-código)

```ts
// 1. Criar cobrança
const payment = await asaas.createPayment(data)

// 2. Aguardar webhook
onWebhook(event) {
  if (event === "PAYMENT_CONFIRMED") {
    confirmReservation()
  }
}

// 3. Cancelamento
if (!paid) {
  await asaas.deletePayment(id)
} else {
  await asaas.refundPayment(id)
}
```

---

# ⚠️ Boas práticas importantes

### ✅ Sempre use webhook

* evita inconsistência
* evita fraude

### ✅ Idempotência

* evite processar webhook duplicado

### ✅ Log de eventos

* salve tudo (debug + auditoria)

### ✅ Política de cancelamento

* implemente antes de integrar pagamento

---

# ✔️ Resumo final

* Criar cobrança → `POST /payments`
* Confirmar → webhook `PAYMENT_CONFIRMED`
* Cancelar antes → `DELETE /payments/{id}`
* Cancelar depois → `POST /payments/{id}/refund`
* Recorrente → `DELETE /subscriptions/{id}`

---

Se quiser, posso te entregar um **SDKzinho em TypeScript já pronto** (com retries, tipagem e webhook handler) — isso acelera MUITO tua implementação.

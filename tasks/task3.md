# Task 3

Agora que já refatoramos o domínio e deixamos isso documentado, vamos fazer a migração da stripe para o asaas API.

Inicialmente, faremos somente o fluxo de cartão de crédito.

Pagamento por PIX não será feito agora, será feito futuramente já que alterará um pouco o fluxo.

Poderemos remover a implementação da stripe, porém, mantendo a mesma estrutura e sequência se possível.

Em `tasks/task3_assets/timeline-log-1776823716585.json` é possível ver o fluxo de requisições feitas de um fluxo de usuário que fez reserva de quadra usando cartão via stripe.

Em `/Users/gabao/repos/ifute-ecossystem/ifute-core-simple/CLAUDE.md` há um pouco sobre a regra de negócio de cancelamentos que se possível manter a mesma com o Asaas, será muito útil.

Lembrando que as taxas atuais do Asaas API podem ser obtidas em...

GET - https://api-sandbox.asaas.com/v3/myAccount/fees

Retorno atualizado em 21/04/2026

```json
{
    "payment": {
        "bankSlip": {
            "defaultValue": 1.99,
            "discountValue": 0.99,
            "expirationDate": "2025-11-26 00:00:00",
            "daysToReceive": 1
        },
        "creditCard": {
            "operationValue": 0.49,
            "oneInstallmentPercentage": 2.99,
            "upToSixInstallmentsPercentage": 3.49,
            "upToTwelveInstallmentsPercentage": 3.99,
            "upToTwentyOneInstallmentsPercentage": 4.29,
            "discountOneInstallmentPercentage": 1.99,
            "discountUpToSixInstallmentsPercentage": 2.49,
            "discountUpToTwelveInstallmentsPercentage": 2.99,
            "discountUpToTwentyOneInstallmentsPercentage": 3.29,
            "hasValidDiscount": false,
            "daysToReceive": 32,
            "discountExpiration": "2025-11-26 00:00:00"
        },
        "debitCard": {
            "operationValue": 0.35,
            "defaultPercentage": 1.89,
            "daysToReceive": 3
        },
        "voucherCard": {
            "defaultPercentage": 3.59,
            "daysToReceive": 15
        },
        "pix": {
            "fixedFeeValue": 1.99,
            "fixedFeeValueWithDiscount": 0.99,
            "percentageFee": null,
            "minimumFeeValue": null,
            "maximumFeeValue": null,
            "discountExpiration": "2025-11-26 00:00:00",
            "type": "FIXED",
            "monthlyCreditsWithoutFee": 100,
            "creditsReceivedOfCurrentMonth": 0
        }
    },
    "transfer": {
        "monthlyTransfersWithoutFee": 30,
        "ted": {
            "feeValue": 5.00,
            "consideredInMonthlyTransfersWithoutFee": false
        },
        "pix": {
            "feeValue": 2.00,
            "discountValue": null,
            "expirationDate": null,
            "consideredInMonthlyTransfersWithoutFee": true
        }
    },
    "asaasCard": {
        "debit": {
            "requestFeeValue": 0.00,
            "deniedReasons": [
                {
                    "code": "asaasCard.denied.register.cantRequestElo",
                    "description": "A solicitação de cartões Elo foi descontinuada."
                }
            ],
            "nationalCashWithdrawalFeeValue": 8.60,
            "internationalCashWithdrawalProcessingFeePercentage": 0.745,
            "internationalCashWithdrawalExchangeFeeValue": 11.00,
            "internationalPurchaseWithdrawalFeePercentage": 3.14
        },
        "prepaid": {
            "requestFeeValue": 0.00,
            "deniedReasons": [
                {
                    "code": "asaasCard.denied.register.cantRequestElo",
                    "description": "A solicitação de cartões Elo foi descontinuada."
                }
            ],
            "nationalCashWithdrawalFeeValue": 8.60,
            "internationalCashWithdrawalProcessingFeePercentage": 0.745,
            "internationalCashWithdrawalExchangeFeeValue": 11.00,
            "internationalPurchaseWithdrawalFeePercentage": 3.14
        },
        "credit": {
            "requestFeeValue": 0.00,
            "deniedReasons": [
                {
                    "code": "asaasCard.denied.register.cantRequestElo",
                    "description": "A solicitação de cartões Elo foi descontinuada."
                }
            ],
            "nationalCashWithdrawalFeeValue": 8.60,
            "internationalCashWithdrawalProcessingFeePercentage": 0.745,
            "internationalCashWithdrawalExchangeFeeValue": 11.00,
            "internationalPurchaseWithdrawalFeePercentage": 3.14
        },
        "combo": {
            "requestFeeValue": 0,
            "deniedReasons": [
                {
                    "code": "asaasCard.denied.promotion.cannotRequestMastercardCombo",
                    "description": "Não é possível solicitar um Cartão Combo da bandeira Mastercard."
                }
            ]
        }
    },
    "notification": {
        "phoneCallFeeValue": 0.55,
        "whatsAppFeeValue": 0.55,
        "messagingFeeValue": 0.99,
        "postalServiceFeeValue": 2.91,
        "smsFeeValue": 0.50
    },
    "creditBureauReport": {
        "naturalPersonFeeValue": 16.99,
        "legalPersonFeeValue": 16.99
    },
    "paymentDunning": {
        "feeValue": 9.90
    },
    "invoice": {
        "feeValue": 0.49
    },
    "anticipation": {
        "bankSlip": {
            "monthlyFeePercentage": 5.790
        },
        "creditCard": {
            "detachedMonthlyFeeValue": 1.25,
            "installmentMonthlyFeeValue": 1.70
        },
        "pix": {
            "monthlyFeePercentage": 5.79
        }
    },
    "bill": {
        "utilityFeeValue": 0
    },
    "childAccount": {
        "creationFeeValue": 12.90
    },
    "cardSale": {
        "anticipation": {
            "detachedPercentage": 0.00,
            "installmentPercentage": 1.25010
        },
        "creditCard": {
            "daysToReceive": 32,
            "hasValidDiscount": false,
            "discountExpiration": null,
            "oneInstallmentPercentage": 2.99,
            "upToSixInstallmentsPercentage": 3.49,
            "upToTwelveInstallmentsPercentage": 3.99,
            "upToTwentyOneInstallmentsPercentage": 4.29,
            "discountOneInstallmentPercentage": 2.85,
            "discountUpToSixInstallmentsPercentage": 3.35,
            "discountUpToTwelveInstallmentsPercentage": 3.85,
            "discountUpToTwentyOneInstallmentsPercentage": 4.15
        },
        "debitCard": {
            "defaultPercentage": 1.25,
            "daysToReceive": 3
        },
        "voucherCard": {
            "defaultPercentage": 3.59,
            "daysToReceive": 15
        }
    },
    "pixDebit": {
        "feeValue": 2.00
    }
}
```


Se precisar de mais informação ou houver dúvida, só perguntar e vamos evoluindo e alinhando o plano de alterações.

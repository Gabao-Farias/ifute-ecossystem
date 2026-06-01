Agora que inteagração com Asaas foi completa, precisamos fazer o deploy do app, backoffice e backend em producao.

Ponto importante é acerca das migrations pois a última executada foi a 1746318492279 e precisamos rodar até 1779000000002 que é a mais atualizada.

A única tabela relevante importante para mantermos salvos os dados é a user que armazena os clientes.

A ideia é executar a migração em comando único .sh com acesso ssh. a partir do repositório ifute-compose.

Verifique a viabilidade, os impactos e as melhorias que forem ne essárias para que isso seja possível.

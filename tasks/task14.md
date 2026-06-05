Atualmente o campo asaas_account_api_key_enc não está exatamente sendo utilizado para nada, sendo que a chave de api que usamos é a declarada no .env

O único campo que é utilizado de fato, é a chave pix do owner do local

Isso fará com que as transações não aparecam no backoffice pois são puxadas a partir desta chave de API, aí no lugar delas, vamos precisar usar dados da tabela court_aapointment_order para exibir os registros financeiros dos locais onde o admin_user é owner.

faça uma verificação geral do que é necessário para completar esta tarefa e se ficarem dúvidas é só perguntar.

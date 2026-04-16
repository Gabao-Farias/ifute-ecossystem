# Task 2

A task 2 será de refatoração de domínio e renomeação de ideias para construirmos tudo de forma organizada e bem documentada.

Glossário:
* Bloco de horário/Time Block = É um bloco de tempo de 30 minutos, que é o que permite que o usuário possa reservar período de por exemplo 1h, 1h30min ou 2h30min e respectivamente eles equivalem à 2 blocos, 3 blocos e 5 blocos, o custo também usa este conceito para saber quando cobrar do cliente final.
* Local/Place = local físico onde pode ter múltiplas quadras de esportes iguais ou diferentes
* Quadra/Court = Significa uma quadra que pertence a um Local/Place esta quadra pode ser de volei, basquete, futebol de campo, futsal, etc... cada quadra, também pode ter valor de bloco de horário definido de forma customizada pelo proprietário. Atualmente isso está como PlaceBlock talvez valha renomear para Court.

Possívelmente hajam mais conceitos importantes de destacar aqui, faça uma análise do que pode ser encontrado de conceito e vamos passar a documentar no claude.md

Dado este glossário de conceitos e ideias, faça um planejamento de pontos que seriam benéficos de refatoração do código, começando pelo ifute-core-simple, que o que interage diretamente com o banco de dados. A ideia aqui é no máximo refatorar nomes, mantendo a mesma lógica que já opera atualmente.

Assim que planejado lá, será possível estender a análise para ifute-backoffice e ifute que são o backoffice e o app respectivamente para entender o que será necessário atualizar no sentido de todos os projetos falarem a mesma linguagem das ideias, conceitos e domínios.

Se ficou dúvida em algum conceito ou parte do que é para fazer, pergunte que ajudarei.

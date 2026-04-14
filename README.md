# Ecossistema iFute

Este repositório serve para organizar e definir as diretrizes para todos os demais projetos que fazem parte da aplicação iFute como um todo.

E todo o ecossistema em si, resume-se em um sistema de gestão de reservas de horários em quadras esportivas onde os jogadores podem acessar o app e agendar horários de forma avulsa ou recorrente, enquanto que os gestores administram a presença de suas quadras esportivas na plataforma, recebendo pagamentos e agendamentos de clientes.

## Repositórios

### App Mobile

Repositório do App disponível abertamente para usuários onde eles podem consultar horários disponíveis das quadras e realizar novos agendamentos.

* Link: https://github.com/Gabao-Farias/ifute
* Local: `./ifute`

### iFute App Match (Certificados Apple)

* Link: https://github.com/Gabao-Farias/match-ifute

### Backoffice Web

Repositório do backoffice, utilizado pelos administradores de quadras esportivas que lhes permite cadastrar as informações e imagens dos locais sob seu domínio, verificar os agendamentos realizados em seus locais, o fluxo de caixa da sua conta entre outras informações.

* Link: https://github.com/Gabao-Farias/ifute-backoffice
* Local: `./ifute-backoffice`

### iFute Landing Page

Repositório da landing page, onde serve para criar novos prospectores que possam querer utilizar tanto como cliente como administrador de quadras esportivas.

* Link: https://github.com/Gabao-Farias/ifute-landing-page
* Local: `./ifute-landing-page`

### iFute Docs

Repositório que organiza documentações como termos de uso ou ainda outros documentos.

* Link: https://github.com/Gabao-Farias/ifute-docs
* Local: `./ifute-docs`

### Core Backend

Backend principal, aqui é onde fica toda a regra de negócio da aplicação, também é a principal API tanto do App como backoffice, no futuro, este repositório pode ser desmembrado em múltiplos outros mantendo somente a regra de negócio neste e dispersando serviços em outros.

* Link: https://github.com/Gabao-Farias/ifute-core-simple
* Local: `./ifute-core-simple`

### iFute jobber

Repositório responsável por disparar processos agendados, cron, de operações administrativas, como por exemplo, emissões de faturas ou cancelamentos para usuários que tenham agendamentos recorrentes criados.

* Link:https://github.com/Gabao-Farias/jobber
* Local: `./jobber`

### ifute-compose

Repositório auxiliar para deploys das aplicações envolvidas.

* Link: https://github.com/Gabao-Farias/ifute-compose
* Local: `./ifute-compose`


### ifute-iptabler

Repositório auxiliar para lidar com bloqueios de IP diretamente no host para previnir ataques ede potenciais agentes maliciosos.

* Link: https://github.com/Gabao-Farias/ifute-iptabler
* Local: `./ifute-iptabler`

## Infraestrutura

Atualmente leve em consideração que o serviço estará sendo executado de forma monolítica e precisamos deixar o app o mais eficiente e simples possível nessa arquitetura enquanto for possível.

A infraestrurua física consiste em uma única máquina VPS acessível por SSH para configuração.

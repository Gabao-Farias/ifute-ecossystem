# Ecossistema iFute

Sistema de reserva de horários em quadras esportivas. Jogadores agendam pelo app mobile, gestores administram pelo backoffice web.

## Estrutura do Ecossistema

Este é um meta-repositório que organiza todos os projetos como subdiretórios:

| Diretório | O que é | Stack |
|---|---|---|
| `ifute/` | App mobile (usuários finais) | React Native / Expo |
| `ifute-backoffice/` | Painel admin (donos de quadra) | React (web) |
| `ifute-core-simple/` | Backend principal (API + regras de negócio) | TypeScript, Express, TypeORM, PostgreSQL |
| `ifute-landing-page/` | Landing page de captação | Web |
| `ifute-docs/` | Termos de uso e documentos legais | — |
| `ifute-compose/` | Docker Compose para deploy | Docker |
| `ifute-iptabler/` | Bloqueio de IPs maliciosos no host | Shell |
| `ifute-jobber/` | Cron jobs (faturas, cancelamentos recorrentes) | — |
| `match-ifute/` | Certificados Apple | — |

Cada subdiretório é um repositório Git independente. Consulte o CLAUDE.md de cada um para detalhes internos (ex: `ifute-core-simple/CLAUDE.md`).

## Infraestrutura

- **Monolítico em VPS única** (AlmaLinux) acessível por SSH
- Deploy via `ifute-compose/` (Docker Compose)
- **Desenvolvimento local em WSL2** — para expor as portas à rede local (testes em dispositivos móveis etc.), rodar `scripts/wsl-expose-ports.ps1` como admin no PowerShell do Windows. Precisa rodar novamente após cada reinício do WSL (IP muda)
- Priorize simplicidade e eficiência; não introduza microsserviços ou complexidade desnecessária
- Banco de dados: PostgreSQL (único, compartilhado)

## Portas e Domínios

Mesmas portas são usadas localmente e em produção (nginx faz reverse proxy por subdomínio via HTTPS):

| Porta | Serviço | Domínio (prod) |
|---|---|---|
| `7100` | `ifute-core-simple` (API backend) | `api.ifute.com.br` |
| `7101` | `ifute-backoffice` (painel admin) | `backoffice.ifute.com.br` |
| `7102` | `ifute-docs` (documentos) | `docs.ifute.com.br` |
| `7103` | `ifute-landing-page` (landing) | `ifute.com.br` |

Configuração nginx: `ifute-compose/nginx/conf.d/default.conf`

## Modelo de Negócio (referência para cálculos)

- Taxa da plataforma: R$ 4,99 por bloco de 30 min reservado
- Gateway de pagamento: Asaas API (migração em andamento, anteriormente Stripe)
  - Pix: ~R$ 1,99/transação
  - Cartão à vista: ~R$ 0,49 + 2,99%
  - Cartão parcelado: até ~4,29% + R$ 0,49
- Comissão de venda: 30% por transação
- Lógica de precificação: o administrador define quanto quer receber, e as taxas são repassadas ao cliente final

## Glossário de Domínio

| Termo (EN) | Termo (PT) | Descrição |
|---|---|---|
| **Place** | Local | Local físico que contém múltiplas quadras (ex: "Arena Futebol 7") |
| **Court** | Quadra | Quadra esportiva pertencente a um Place. Pode ser de futebol, vôlei, tênis, etc. Cada quadra tem preço próprio por bloco de horário |
| **Time Block** | Bloco de horário | Período de 30 minutos — unidade mínima de reserva. Ex: 1h = 2 blocos, 1h30 = 3 blocos |
| **CourtAppointment** | Agendamento | Reserva avulsa de um bloco de horário em uma quadra |
| **CourtRecurrentAppointment** | Agendamento recorrente | Reserva que se repete semanalmente nos mesmos dias/horários |
| **CourtAppointmentOrder** | Ordem de pagamento | Vincula o pagamento (Stripe/Asaas) aos agendamentos de uma reserva |
| **price_per_time_block** | Preço por bloco | Valor em R$ que o admin define por bloco de 30 min para cada quadra |

## Convenções

- Idioma do código: inglês. Idioma de comunicação e documentação: português (BR)
- Toda regra de negócio fica em `ifute-core-simple/` — nunca duplique lógica nos frontends
- Tasks pendentes ficam em `tasks/`
- Ao trabalhar em um subprojeto específico, leia o CLAUDE.md dele primeiro

## O que evitar

- Não crie microsserviços ou separe o backend sem discussão prévia
- Não adicione dependências pesadas ou infra complexa — a VPS é limitada
- Não duplique entidades ou regras de negócio entre repositórios

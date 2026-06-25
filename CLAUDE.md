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

## Deploy

Todo o deploy é orquestrado por `ifute-compose/` (Docker Compose em VPS única, via SSH). **Sem registry externo**: as imagens são buildadas localmente, exportadas com `docker save`, enviadas por `rsync` e carregadas no servidor com `docker load`. Documentação completa (Ansible, SSL, túnel de banco, backups) em [`ifute-compose/README.md`](ifute-compose/README.md).

Há **dois tipos de deploy**, intencionalmente separados (rodar de dentro de `ifute-compose/`):

| Quando muda... | Comando | O que faz |
|---|---|---|
| Código de um app | `./scripts/release.sh <app> [<app> ...]` (ou `all`) | Builda a imagem `<nome>:<version do package.json>`, sincroniza a `*_TAG` no `.env`, envia e recria **só aquele(s) serviço(s)** |
| Compose, nginx ou `.env*` | `./scripts/deploy-prd.sh` | Envia **só a configuração** e recria os containers com as imagens já presentes |

Apps válidos para `release.sh`: `ifute-core-simple`, `ifute-backoffice`, `ifute-jobber`, `ifute-docs`, `ifute-landing-page`.

Pontos de atenção:

- **Versionar antes de releasar**: a tag da imagem vem da `version` do `package.json` do app. Bumpe a versão (`npm version patch --no-git-tag-version`) e commite **antes** do `release.sh`, senão a nova imagem reusa uma tag já em produção.
- **Arquitetura**: a VPS é x86_64; o `release.sh` builda sempre para `linux/amd64`. Em máquina ARM (Apple Silicon) isso usa emulação qemu — mais lento, porém correto. O script falha cedo se a arquitetura não bater.
- **Migrações de banco**: controladas, **não automáticas**. O boot do `ifute-core-simple` não aplica migrations em prod (`RUN_MIGRATIONS_ON_BOOT` default `false` quando `NODE_ENV=prd`), e o `release.sh` também não. Após um release do core que inclua migrations, rodar `./scripts/migrate-prd.sh` (backup → `migrations:run:prod` → verificação) é **obrigatório**.

## Modelo de Negócio (referência para cálculos)

- Taxa da plataforma: R$ 4,99 por bloco de 30 min reservado (`tax_value_per_time_block`)
- Gateway de pagamento: Asaas API (via abstração `PaymentProvider` — backend agnóstico a provider, mas hoje só Asaas está plugado)
  - **PIX IN** (recebimento da cobrança): ~R$ 1,99/transação
  - Cartão à vista: ~R$ 0,49 + 2,99%
  - Cartão parcelado: até ~4,29% + R$ 0,49
  - **PIX OUT** (saque/repasse de saída): R$ 2,00 por saque — taxa **distinta** do PIX IN, configurável em `BusinessConfig.withdrawal_fee_cents`, descontada de quem saca (Task 18)
- Comissão de venda: 30% por transação
- Lógica de precificação: o administrador define quanto quer receber, e as taxas são repassadas ao cliente final

### Programa de Afiliados (padrinhos)

Todo admin do backoffice pode gerar um **link de indicação**. Quando outro admin se cadastra usando esse link, vira **afiliado** do indicador (padrinho). O padrinho passa a receber comissão de cada agendamento feito nas quadras do afiliado.

- **Comissão**: 20% sobre `tax_value_per_time_block` por bloco agendado, arredondado para baixo em centavos. Hoje: `floor(20 × 499 / 100) = 99` centavos por bloco. Plataforma fica com R$ 4,00 por bloco (antes dos custos do Asaas)
- **Duração do vínculo**: indeterminada. Uma vez criado, o vínculo nunca expira — todas as orders das quadras do afiliado continuam gerando comissão indefinidamente
- **Indicação direta apenas**: sem multinível. Se A indica B e B indica C, A não ganha nada de C
- **Auto-afiliação bloqueada**: admin não pode usar o próprio link
- **Vínculo imutável**: uma vez criado, afiliado não pode trocar de padrinho
- **Snapshot por order**: o percentual e o valor calculado da comissão são gravados na ordem no momento da compra (`affiliate_commission_value_cents`, `affiliate_commission_percent_at_order`). Mudanças futuras na configuração não afetam orders já criadas
- **Chave PIX dedicada**: o padrinho cadastra uma chave PIX **separada** da chave usada para receber pelos seus próprios locais. Por isso a aba dedicada no backoffice (`/dashboard/affiliates`)
- **Pagamento (Task 18)**: a comissão é acumulada num **saldo de comissões** (segundo saldo do admin, separado do saldo de quadras). O cron `collect_cash` Fase 2 **credita** o saldo (não faz mais PIX out por order); o padrinho **saca sob demanda** no backoffice, pagando a taxa de saque do Asaas (R$ 2,00). Saldo de quadras e de comissões são sacados separadamente, cada um para sua chave PIX
- **Estorno após settlement**: por contrato com o usuário, estornos só podem ocorrer enquanto o capital ainda está na master da iFute (antes da janela de cancelamento), então não tratamos chargebacks após o saldo ser creditado

Detalhes técnicos do fluxo (snapshot, cron, saque, webhook auth, edge cases) em [`ifute-core-simple/CLAUDE.md`](ifute-core-simple/CLAUDE.md). Planejamento: afiliação em [`tasks/task11-planning.md`](tasks/task11-planning.md); saldo/saque em [`tasks/task18-planning.md`](tasks/task18-planning.md).

## Identidade Visual

- **Verde de marca**: `#32E75F` (verde vivo do logo) — cor principal do ecossistema. Em HSL ≈ `hsl(135 79% 55%)`; sobre fundos claros, use uma variante levemente escurecida (`hsl(142 72% 38%)`) para garantir contraste AA.
- **Ambiente escuro**: `#05230C` (mais escuro: `#001004`) — fundo das seções de destaque ("ink").
- **Tipografia**: Inter.
- **Fonte de verdade do tema**: `ifute-backoffice/src/index.css` (tokens estilo shadcn/ui, claro + escuro). A `ifute-landing-page` deriva sua paleta desses mesmos tokens.

## Glossário de Domínio

| Termo (EN) | Termo (PT) | Descrição |
|---|---|---|
| **Place** | Local | Local físico que contém múltiplas quadras (ex: "Arena Futebol 7") |
| **Court** | Quadra | Quadra esportiva pertencente a um Place. Pode ser de futebol, vôlei, tênis, etc. Cada quadra tem preço próprio por bloco de horário |
| **Time Block** | Bloco de horário | Período de 30 minutos — unidade mínima de reserva. Ex: 1h = 2 blocos, 1h30 = 3 blocos |
| **CourtAppointment** | Agendamento | Reserva avulsa de um bloco de horário em uma quadra |
| **CourtRecurrentAppointment** | Agendamento recorrente | Reserva que se repete semanalmente nos mesmos dias/horários |
| **CourtAppointmentOrder** | Ordem de pagamento | Vincula o pagamento (provider ativo, ex: Asaas) aos agendamentos de uma reserva |
| **price_per_time_block** | Preço por bloco | Valor em R$ que o admin define por bloco de 30 min para cada quadra |
| **tax_value_per_time_block** | Taxa da plataforma por bloco | Valor em R$ que a iFute cobra por bloco agendado (R$ 4,99 hoje). Base do cálculo da comissão de afiliação |
| **Referrer / Partner** | Padrinho / Parceiro | Admin que indicou outro admin via seu link de afiliação |
| **Affiliate** | Afiliado / Indicado | Admin que se cadastrou usando o link de outro admin. Vínculo por tempo indeterminado |
| **Referral Code** | Código de indicação | Identificador único do admin usado em `?ref=CÓDIGO` no link de signup |
| **Affiliate Commission** | Comissão de afiliação | 20% do `tax_value_per_time_block` repassado ao padrinho a cada bloco agendado nas quadras do afiliado |

## Convenções

- Idioma do código: inglês. Idioma de comunicação e documentação: português (BR)
- Toda regra de negócio fica em `ifute-core-simple/` — nunca duplique lógica nos frontends
- Tasks pendentes ficam em `tasks/`
- Ao trabalhar em um subprojeto específico, leia o CLAUDE.md dele primeiro

## O que evitar

- Não crie microsserviços ou separe o backend sem discussão prévia
- Não adicione dependências pesadas ou infra complexa — a VPS é limitada
- Não duplique entidades ou regras de negócio entre repositórios

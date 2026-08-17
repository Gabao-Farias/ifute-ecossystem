# Ecossistema iFute

Sistema de reserva de horários em quadras esportivas. Jogadores agendam pelo app mobile, gestores administram pelo backoffice web.

## Estrutura do Ecossistema

Este é um meta-repositório que organiza todos os projetos como subdiretórios:

| Diretório | O que é | Stack |
|---|---|---|
| `ifute/` | App mobile (usuários finais) | React Native / Expo |
| `ifute-backoffice/` | Painel admin (donos de quadra) | React (web) |
| `ifute-master-backoffice/` | Backoffice mestre da diretoria — painel global (Task 23). Ferramenta **local**, roda em `localhost:7104` e bate na API de prod | React 19 / Vite (web) |
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
- **Logs**: todos os containers usam o driver `journald`, então o histórico sobrevive a releases e reboots (~28 dias, teto de 250 MB). Ler com `journalctl CONTAINER_TAG=ifute-core-simple --since "5 days ago" -o cat`. Detalhes em [`ifute-compose/README.md`](ifute-compose/README.md#logs)

## Testes em Produção

Por convenção, **Places de teste criados em produção usam coordenadas fixas no meio do Atlântico Sul** (lat `-54.441196`, lon `-36.554195` — campos `lat`/`lon` de `PlaceLocation`). O ponto é deliberadamente remoto (ninguém mora por perto), então quadras ali nunca aparecem em buscas de usuários reais, permitindo validar fluxos em produção sem poluir a experiência de ninguém. Ao analisar dados de prod, Places nessas coordenadas podem ser tratados como dados de teste.

## Portas e Domínios

Mesmas portas são usadas localmente e em produção (nginx faz reverse proxy por subdomínio via HTTPS):

| Porta | Serviço | Domínio (prod) |
|---|---|---|
| `7100` | `ifute-core-simple` (API backend) | `api.ifute.com.br` |
| `7101` | `ifute-backoffice` (painel admin) | `backoffice.ifute.com.br` |
| `7102` | `ifute-docs` (documentos) | `docs.ifute.com.br` |
| `7103` | `ifute-landing-page` (landing) | `ifute.com.br` |
| `7104` | `ifute-master-backoffice` (backoffice mestre da diretoria) | — (sem deploy/domínio: roda em `localhost:7104`, batendo na API de prod) |

Configuração nginx: `ifute-compose/nginx/conf.d/default.conf`

> **`7104` não passa pelo nginx nem tem domínio.** O master-backoffice é uma ferramenta local da diretoria; o backend expõe o app dedicado `backoffice-director` (prefixo `/director`) cujo CORS libera a origem `http://localhost:7104`. Por isso o `release.sh` não o inclui e ele não aparece no `docker-compose.yml`.

## Deploy

Todo o deploy é orquestrado por `ifute-compose/` (Docker Compose em VPS única, via SSH). **Sem registry externo**: as imagens são buildadas localmente, exportadas com `docker save`, enviadas por `rsync` e carregadas no servidor com `docker load`. Documentação completa (Ansible, SSL, túnel de banco, backups) em [`ifute-compose/README.md`](ifute-compose/README.md).

Há **dois tipos de deploy**, intencionalmente separados (rodar de dentro de `ifute-compose/`):

| Quando muda... | Comando | O que faz |
|---|---|---|
| Código de um app | `./scripts/release.sh <app> [<app> ...]` (ou `all`) | Builda a imagem `<nome>:<version do package.json>`, sincroniza a `*_TAG` no `.env`, envia e recria **só aquele(s) serviço(s)** |
| Compose, nginx ou `.env*` | `./scripts/deploy-prd.sh` | Envia **só a configuração** e recria os containers com as imagens já presentes |

Apps válidos para `release.sh`: `ifute-core-simple`, `ifute-backoffice`, `ifute-jobber`, `ifute-docs`, `ifute-landing-page`.

### Arquivos `.env` do deploy — `ifute-envs/`

Os `.env` de produção **não são versionados** no `ifute-compose/`. Ficam no repositório privado [`ifute-envs`](https://github.com/Gabao-Farias/ifute-envs) (`git@github.com:Gabao-Farias/ifute-envs.git`), clonado como `ifute-envs/` neste meta-repositório.

O `deploy-prd.sh` aborta se estes três não existirem na raiz do `ifute-compose/`:

| Arquivo | Conteúdo | Fonte de verdade |
|---|---|---|
| `.env.ifute-core-simple` | segredos do backend + Postgres | `ifute-envs/` |
| `.env.ifute-jobber` | segredos dos cron jobs | `ifute-envs/` |
| `.env` | **tags das imagens** (`*_TAG`) | `ifute-compose/` local |

> ⚠️ **Não copie o `.env` do `ifute-envs/` por cima.** Diferente dos outros dois, ele é reescrito pelo `release.sh` a cada release (sincroniza a `*_TAG`), então a cópia no `ifute-envs/` fica defasada e sobrescrevê-la causa **rollback silencioso de versão** no próximo `deploy-prd.sh`. Em 10/08/2026 o `ifute-envs/.env` apontava `IFUTE_CORE_SIMPLE_TAG=0.3.5` enquanto produção rodava `0.3.6`. Antes de copiar qualquer `.env`, compare com o que está rodando: `ssh -p 51765 root@api.ifute.com.br 'docker ps --format "{{.Names}}\t{{.Image}}"'`.

Pontos de atenção:

- **Versionar antes de releasar**: a tag da imagem vem da `version` do `package.json` do app. Bumpe a versão (`npm version patch --no-git-tag-version`) e commite **antes** do `release.sh`, senão a nova imagem reusa uma tag já em produção.
- **Arquitetura**: a VPS é x86_64; o `release.sh` builda sempre para `linux/amd64`. Em máquina ARM (Apple Silicon) isso usa emulação qemu — mais lento, porém correto. O script falha cedo se a arquitetura não bater.
- **Migrações de banco**: controladas, **não automáticas**. O boot do `ifute-core-simple` não aplica migrations em prod (`RUN_MIGRATIONS_ON_BOOT` default `false` quando `NODE_ENV=prd`), e o `release.sh` também não. Após um release do core que inclua migrations, rodar `./scripts/migrate-prd.sh` (backup → `migrations:run:prod` → verificação) é **obrigatório**.

## Modelo de Negócio (referência para cálculos)

- Taxa da plataforma: R$ 4,99 por bloco de 30 min reservado (`tax_value_per_time_block`)
- Gateway de pagamento: Asaas API (via abstração `PaymentProvider` — backend agnóstico a provider, mas hoje só Asaas está plugado)
  - **PIX é o único meio de pagamento em produção.** Cartão de crédito está desligado: o app só renderiza os meios liberados pelas flags de Firebase Remote Config, e `useCreditCardPayment` tem default `false` (`ifute/src/services/remoteConfig.ts`). Todo cálculo de custo, precificação e material comercial deve assumir **somente PIX**
  - **PIX IN** (recebimento da cobrança): ~R$ 1,99 **por cobrança** (não por bloco). **Repassado ao cliente final, não descontado da taxa da plataforma** — `finalValue = netValue + (taxa × blocos) + 1,99` (`calculateAsaasPixCostBreakdown`). Logo a margem da plataforma é constante em `tax_value_per_time_block` por bloco, independente da duração da reserva; quem se beneficia de reserva longa é o **jogador**, que dilui o R$ 1,99 fixo em mais blocos
  - **PIX OUT** (saque/repasse de saída): R$ 2,00 por saque — taxa **distinta** do PIX IN, configurável em `BusinessConfig.withdrawal_fee_cents`, descontada de quem saca (Task 18)
  - O caminho de cartão **ainda existe no código** (`AsaasProvider.createCreditCardPayment`, e o `createAuthorizedPayment` cai em `credit-card` quando `paymentMethod` não é informado). É legado das tasks 3/6 — não construa nada novo sobre ele e sempre passe `paymentMethod: "pix"` explicitamente
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
- Relatórios ficam em `reports/`, divididos por tempo de vida:
  - `reports/historico/` — **snapshots datados**, nomeados `AAAA-MM-DD-assunto.md` (data de geração primeiro, para ordenar cronologicamente por nome). Ex: `2026-08-08-rastreio-usuario-prod.md`. Retratam um momento e não são reescritos; é onde o `analyze-prod-logins.mjs` grava
  - `reports/` (raiz) — **documentos vivos**, sem data no nome, atualizados conforme novos snapshots surgem. Ex: [`demanda-organica.md`](reports/demanda-organica.md), o mapa de onde há demanda real pelo app
- Ao trabalhar em um subprojeto específico, leia o CLAUDE.md dele primeiro

## O que evitar

- Não crie microsserviços ou separe o backend sem discussão prévia
- Não adicione dependências pesadas ou infra complexa — a VPS é limitada
- Não duplique entidades ou regras de negócio entre repositórios
